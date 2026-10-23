# Finalized 链上业务确认方案

## 1. 方案目标

本文档用于指导后续链上确认流程改造，目前仅为设计方案，不代表代码已经实现。

目标：

- 使用一个可信的 BSC 主网 RPC。
- 所有成功和失败结论都以 `finalized` 区块为准。
- 链上状态无法确定时保持 `pending`，禁止提前退款或入账。
- 即时确认由前端轮询触发，后端每次请求只检查一次。
- 有数据库 pending 记录的业务由定时任务最终兜底。
- 免费矿机通过交易 hash 即时确认，并支持按钱包地址从 finalized 事件恢复。
- 不修改现有数据库结构和智能合约。

覆盖业务：

- 普通 SPACE/USDT 提现。
- 回购 SPACE/USDT 充值。
- 回购 SPACE/USDT 提现。
- 购买矿机和复投。
- 免费矿机领取。

## 2. 核心安全规则

签名 nonce 的统一判定规则：

```text
finalized nonce=true
→ USED

finalized nonce=false
且 finalizedBlock.timestamp > deadline
→ EXPIRED_UNUSED

finalized nonce=false
且 finalizedBlock.timestamp <= deadline
→ PENDING

RPC或合约读取异常
→ PENDING
```

必须严格使用：

```text
finalizedBlock.timestamp > deadline
```

区块时间等于 deadline 时，签名仍可能有效。

禁止使用以下方式判断签名失败：

- 服务器当前时间超过 deadline。
- `latest` nonce 返回 false。
- 前端轮询超时。
- RPC 请求失败。
- pending 持续时间过长。

## 3. Finalized 区块读取

在 `Web3Service` 增加：

```ts
type FinalizedBlock = {
  number: bigint;
  hash: `0x${string}`;
  timestamp: bigint;
};

async getFinalizedBlock(): Promise<FinalizedBlock> {
  const block = await this.publicClient.getBlock({
    blockTag: 'finalized',
  });

  if (
    block.number === null ||
    block.hash === null ||
    block.timestamp === undefined
  ) {
    throw new CustomException('CHAIN_STATE_UNAVAILABLE', 503);
  }

  return {
    number: block.number,
    hash: block.hash,
    timestamp: block.timestamp,
  };
}
```

不校验 Chain ID，不比较 finalized 区块时间与服务器当前时间，也不设置区块新鲜度阈值。

RPC 不支持 finalized、请求超时或返回无效区块时，本次确认停止，业务状态保持 pending。

## 4. 公共代码结构

建议结构：

```text
Web3Service
├── getFinalizedBlock()
├── getClaimNoncesUsed(nonces, blockNumber)
├── getWithdrawUsdtNoncesUsed(nonces, blockNumber)
├── getPurchaseMinerNoncesUsed(nonces, blockNumber)
└── getBuybackDepositNoncesUsed(nonces, blockNumber)
```

所有 nonce 查询必须接收明确的 `blockNumber`，禁止在方法内部默认读取 latest。

状态判定使用纯函数：

```ts
type NonceDecision = 'USED' | 'PENDING' | 'EXPIRED_UNUSED';

function getNonceDecision(
  used: boolean,
  finalizedTimestamp: bigint,
  deadline: number,
): NonceDecision {
  if (used) return 'USED';
  if (finalizedTimestamp > BigInt(deadline)) return 'EXPIRED_UNUSED';
  return 'PENDING';
}
```

链上读取层只返回区块和 nonce 状态，不直接修改数据库。各业务服务复用自己的事务结算方法。

## 5. 前端即时确认

### 5.1 后端确认接口

普通提现、回购充值、回购提现、购买矿机和复投均提供幂等的 nonce 确认接口。

该接口不是单纯查询数据库状态。签名记录仍为 pending 时，每一次前端轮询请求都必须即时读取 finalized 链上状态；不能直接返回数据库中的 pending，也不能等待定时任务更新后再返回。

每次请求只执行一次：

```text
验证nonce属于当前登录用户
→ 查询签名记录
→ 已经used或unused则直接返回数据库状态
→ 获取finalized区块
→ 在finalizedBlock.number读取nonce
→ 计算USED/PENDING/EXPIRED_UNUSED
→ USED或EXPIRED_UNUSED时立即完成事务结算
→ 数据库事务提交后返回used或unused
→ 链上仍无法确定时才返回pending
```

也就是说，一次确认请求应当在同一个请求周期内完成：

```text
读取链上最新finalized状态
→ 发现链上状态变化
→ 立即写入数据库
→ 将写入后的最终状态返回前端
```

只有数据库记录已经是 used 或 unused 时，才可以不访问链上并直接返回。只读取数据库状态的接口不能用于即时轮询，否则即时确认将退化为等待定时任务。

统一响应：

```ts
type NonceStatusResponse = {
  status: 'used' | 'pending' | 'unused';
};
```

RPC 异常可以返回 `CHAIN_STATE_UNAVAILABLE`。前端将其视为暂时无法确认，不得显示业务失败。

### 5.2 前端轮询

钱包返回交易 hash 后，前端立即调用确认接口。状态为 pending 时，等待 3 秒再次调用同一个确认接口。每一次调用都会重新读取 finalized 链上状态，并可能直接完成数据库结算。

使用递归 `setTimeout`，保证上一次请求结束后才发起下一次请求：

```ts
async function pollNonce() {
  const result = await checkNonce(nonce);

  if (result.status === 'pending') {
    timer = window.setTimeout(pollNonce, 3000);
    return;
  }

  await refreshData();
}
```

要求：

- 禁止使用可能产生重叠请求的 `setInterval`。
- 组件卸载、账户切换或网络切换时清理定时器。
- 设置最大轮询时间，避免页面永久请求。
- 达到上限只停止轮询，不修改后台状态。
- 长时间未确认时提示“交易已提交，等待链上最终确认”，不能提示交易失败。
- 页面重新进入后，以后台数据库状态为准刷新数据。

## 6. 数据库定时兜底

普通提现、回购充值、回购提现、购买矿机和复投都有数据库 pending 签名记录，由现有 worker 定时任务兜底。

定时任务只负责用户关闭页面、断网、停止轮询或确认接口持续异常等场景，不能作为前端即时轮询的数据更新前提。

每轮任务：

```text
获取一次finalized区块
→ 查询该业务全部pending签名
→ 按nonce类型批量读取链上状态
→ 所有读取指定同一个blockNumber
→ 使用同一个finalized timestamp判断deadline
→ 逐条执行幂等结算
```

必须扫描全部 pending，不能只扫描服务器时间已经超过 deadline 的记录。这样才能处理：

- 用户没有调用确认接口。
- 用户发送交易后立即关闭页面。
- 前端断网或轮询达到上限。
- 即时确认期间 RPC 异常。

结果处理：

```text
USED
→ 成功结算

EXPIRED_UNUSED
→ 执行对应退款或过期处理

PENDING
→ 不修改数据，等待下一轮
```

## 7. 普通提现

使用现有数据：

```text
account_withdraw_signature
account.balance
account.usdt_balance
account_balance_log
```

流程：

```text
生成提现签名
→ 预扣普通余额并写withdraw流水
→ 保存pending签名
→ 前端立即刷新暂扣后的余额
→ 用户调用Mining.claim或Mining.withdrawUsdt
→ 钱包返回hash后前端轮询确认接口
→ 定时任务兜底
```

结算：

```text
USED
→ 签名标记used

EXPIRED_UNUSED
→ 退回SPACE或USDT普通余额
→ 写withdraw_refund流水
→ 签名标记unused
```

## 8. 回购充值

使用现有数据：

```text
buyback_signature(kind=deposit)
account.buyback_space_balance
account.buyback_usdt_balance
buyback_balance_log
```

流程：

```text
后端检查回购开关并生成充值签名
→ 保存pending签名，不增加内部余额
→ 前端检查并完成ERC20 approve
→ 用户调用BuybackDepositGateway.deposit
→ 合约验证签名和deadline
→ 合约将钱包代币直接transferFrom到Mining
→ 合约标记usedDepositNonces并触发Deposited事件
→ 钱包返回hash后前端轮询确认接口
→ 定时任务兜底
```

结算：

```text
USED
→ 增加buyback_space_balance或buyback_usdt_balance
→ 写deposit流水
→ 签名标记used

EXPIRED_UNUSED
→ 签名标记unused
→ 不增加余额
→ 不退款
```

充值签名生成时没有扣除内部余额；链上充值失败时整笔交易回滚，因此 EXPIRED_UNUSED 不需要退款。

## 9. 回购提现

使用现有数据：

```text
buyback_signature(kind=withdraw)
account.buyback_space_balance
account.buyback_usdt_balance
buyback_balance_log
```

流程与普通提现一致，但预扣和退款使用回购余额。

```text
USED
→ 签名标记used

EXPIRED_UNUSED
→ 退回buyback_space_balance或buyback_usdt_balance
→ 写withdraw_refund流水
→ 签名标记unused
```

## 10. 购买矿机与复投

使用现有 `miner_purchase_signature` pending 记录。

流程：

```text
生成购买签名并保存pending
→ 按现有规则预扣内部SPACE部分
→ 用户调用合约
→ 钱包返回hash后前端轮询确认接口
→ 定时任务兜底
```

结算：

```text
USED
→ 签名标记used
→ 在同一事务内创建矿机或完成复投

EXPIRED_UNUSED
→ 退回签名生成时实际预扣的内部SPACE
→ 签名标记unused
```

现有退款计算规则继续保留：

```ts
const refundAmount =
  signature.paymentToken === PaymentToken.Space
    ? BigInt(signature.price) - BigInt(signature.payValue)
    : 0n;
```

不得对链上支付部分执行数据库退款。

## 11. 免费矿机

免费矿机由用户直接调用 `Mining.claimFreeMiner()`，不生成后台签名，也没有数据库 pending 签名记录。

### 11.1 交易 hash 即时确认

钱包返回 hash 后，前端轮询免费矿机确认接口。后端每次：

```text
获取finalized区块
→ 查询交易receipt
→ receipt不存在则返回pending
→ receipt.blockNumber大于finalizedBlock.number则返回pending
→ 校验receipt.blockHash对应规范链区块
→ receipt.status失败则返回failed
→ 只解析Mining合约的FreeMinerClaimed事件
→ 校验事件account等于当前用户地址
→ 使用事件amount和区块timestamp创建免费矿机
```

只有交易所在区块已经 finalized，才能创建数据库记录。

### 11.2 页面关闭后的恢复

用户重新进入免费矿机页面且数据库没有记录时，后端按钱包地址恢复：

```text
获取finalized区块
→ 在finalizedBlock.number读取claimedFreeMiners(address)
→ false：尚未发现finalized领取结果
→ true：查询FreeMinerClaimed事件
→ 按indexed account过滤用户地址
→ 获取transactionHash、spaceAmount和blockNumber
→ 查询事件区块timestamp
→ 幂等创建免费矿机记录
```

事件查询范围从 Mining 合约部署区块到当前 finalized 区块。RPC 限制单次区块范围时必须分段查询。

免费矿机每个钱包只能领取一次，因此只接受该钱包唯一的 `FreeMinerClaimed` 事件。数据库现有账户和 hash 唯一约束继续作为最终防重保障。

如果用户发送交易后关闭页面，数据库记录可以在用户下次进入页面时恢复；奖励开始时间仍使用领取事件的区块时间，不使用恢复时间。

## 12. 并发与幂等

前端可能重复请求，多个页面可能同时轮询，前端请求也可能与定时任务同时结算。

所有最终结算必须使用同一个业务结算方法：

```text
事务外读取finalized链上状态
→ 开启数据库事务
→ pessimistic_write锁定pending签名记录
→ 再次确认status仍为pending
→ 锁定相关账户或矿机记录
→ 修改余额和业务数据
→ 写资金流水
→ 修改签名状态
→ 提交事务
```

RPC 查询不得放在数据库事务内部，避免 RPC 变慢时长期占用行锁。

如果另一个流程已经完成结算：

```text
查询不到pending记录
→ 不再修改余额或写流水
→ 读取并返回当前数据库状态
```

免费矿机的 hash 确认和地址恢复也可能并发。插入时依靠事务及现有账户/hash唯一约束，唯一冲突后读取已有记录并返回成功。

## 13. 异常处理

以下情况不得结算为失败或退款：

- finalized 区块读取失败。
- nonce 查询失败。
- finalized nonce=false，但区块时间尚未超过 deadline。
- 前端请求超时、断网、关闭页面或停止轮询。
- 定时任务某一轮执行失败。

定时任务读取 finalized 区块失败时，本轮整体停止，所有记录保持 pending。批量读取中单条业务结算失败时，记录错误并保留该记录，不能影响其他记录继续处理。

## 14. 前端状态与提示

建议统一状态：

```text
pending  → 等待链上最终确认
used     → 操作成功
unused   → 签名已过期或操作未完成
failed   → 仅用于已经finalized且receipt明确失败的免费矿机交易
```

前端轮询期间显示轻量加载状态，不要持续锁死整个页面。

达到轮询上限时提示：

```text
交易已提交，正在等待链上最终确认，可稍后查看结果
```

提现签名生成后余额已经暂扣，即使用户在钱包中取消，也要立即刷新页面余额；最终退款由 finalized 判定和定时任务完成。

## 15. 测试清单

### 公共判定

- nonce=true 返回 USED。
- nonce=false 且 finalized timestamp 等于 deadline 时返回 PENDING。
- nonce=false 且 finalized timestamp 大于 deadline 时返回 EXPIRED_UNUSED。
- 所有 nonce 与时间来自同一个 finalized 区块。
- RPC 异常时数据库不发生结算。
- 不使用服务器时间判断退款。

### 前端轮询

- 钱包返回 hash 后立即开始轮询。
- 上一次请求结束后才启动下一次请求。
- 组件卸载和账户切换会停止轮询。
- 达到轮询上限只显示等待确认，不显示失败。
- 多个页面重复轮询不会重复结算。

### 定时任务

- 扫描全部 pending，而不是只扫描过期记录。
- 用户未调用确认接口时仍能确认成功交易。
- 前端请求与定时任务并发时只结算一次。
- 单条结算失败不影响其他记录。

### 资金业务

- 普通 SPACE/USDT 提现成功和过期退款正确。
- 回购 SPACE/USDT 充值只在 finalized nonce=true 后入账。
- 回购 SPACE/USDT 提现成功和过期退款正确。
- 购买矿机和复投只在 finalized nonce=true 后创建或更新。
- 购买签名过期时只退回实际预扣的内部 SPACE。
- 所有资金流水只写入一次。

### 免费矿机

- receipt 未找到或未 finalized 时保持 pending。
- finalized 失败交易返回 failed，且不创建矿机。
- finalized 成功交易能正确解析事件并创建矿机。
- 事件账户与当前用户不一致时拒绝处理。
- 页面关闭后能通过 claimedFreeMiners 和事件恢复记录。
- hash 即时确认与地址恢复并发时只创建一条记录。

## 16. 代码清理范围

即时确认改造完成后，删除不再使用的队列代码：

- `BuybackProcessor`。
- `MinerProcessor`。
- `buyback-queue` 和 `miner-queue` 注册。
- `BuybackService`、`MinerService` 中的 Queue 注入和 add 调用。
- `WorkerModule` 中的 Processor provider。
- user-api 和 worker 中不再需要的队列根配置。
- 确认没有其他用途后删除 `@nestjs/bullmq`、`bullmq` 依赖和对应 Redis 队列配置。

保留现有定时任务服务。定时任务仍由 Nest Schedule 和 worker 进程执行。

## 17. 上线顺序

1. 确认生产 RPC 支持 `finalized` 区块标签和历史区块读取。
2. 确认 RPC 支持按 indexed account 查询 `FreeMinerClaimed` 日志。
3. 实现公共 finalized 区块与指定区块 nonce 查询。
4. 实现各业务幂等确认接口和定时任务。
5. 实现免费矿机 hash 确认及地址恢复。
6. 更新前端轮询逻辑。
7. 完成并发、退款、充值和免费矿机恢复测试。
8. 更新 server、worker 和 web。
9. 观察数据库 pending 数量、RPC 错误、退款流水和前端轮询请求量。
10. 确认新流程稳定后清理队列代码和依赖。

本方案不需要数据库迁移，也不需要修改智能合约。

## 18. 参考

- BNB Chain Finality：<https://docs.bnbchain.org/bnb-smart-chain/introduction/>
- Viem `getBlock`：<https://viem.sh/docs/actions/public/getBlock>
- Viem `readContract`：<https://viem.sh/docs/contract/readContract>
- Viem `getLogs`：<https://viem.sh/docs/actions/public/getLogs>
