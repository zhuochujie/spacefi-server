# SPACE 回购功能流程

## 1. 整体模式

链上只处理充值和提现，买卖交易全部在后台数据库完成。

```text
用户充值SPACE或USDT
→ 后台增加内部余额

普通用户卖出内部SPACE
→ 后台扣SPACE、增加USDT
→ 回购池增加可购买SPACE

做市商购买内部SPACE
→ 后台扣USDT、增加SPACE
→ 回购池减少可购买SPACE

用户提现
→ 从Mining提取SPACE或USDT到钱包
```

内部余额独立存储：

```text
buyback_space_balance
buyback_usdt_balance
```

## 2. 充值

充值前由后台生成签名。新合约只负责验证充值签名、执行 `transferFrom` 和标记 nonce。

### SPACE 充值

```text
用户SPACE → Mining
nonce标记已使用
后端确认nonce后：buyback_space_balance += amount
```

Mining 在 SPACE 白名单中，因此充值不收 SPACE 转账税。

### USDT 充值

普通用户或做市商充值到自己的内部余额：

```text
用户USDT → Mining
nonce标记已使用
后端确认nonce后：buyback_usdt_balance += amount
```

前端等待交易回执后只提交 nonce，BullMQ 立即检查，定时任务兜底。

`available_usdt` 由管理后台手动增加，作为用户卖出 SPACE 时的平台支付额度。
该数值只是后台账面额度，设置前必须确保 Mining 合约中有足够的实际 USDT。

## 3. 普通用户卖出 SPACE

用户卖出的是内部 `buyback_space_balance`，不再发起链上交易。

后台数据库事务：

```text
1. 锁定用户账户
2. 锁定回购池和当天价格状态
3. 检查用户SPACE余额
4. 检查平台可用USDT额度
5. 根据当天阶梯价格计算USDT
6. 用户buyback_space_balance -= spaceAmount
7. 按SELL_FEE_BP计算卖出手续费
8. 用户buyback_usdt_balance += 成交额 - 手续费
9. 回购池available_space += spaceAmount
10. 平台available_usdt只扣除用户实际到账金额，手续费留在回购池
11. 更新当天用户卖出累计数量
12. 写入成交总额、手续费和实际到账金额
```

数据库事务提交后立即返回成功，不需要等待链上确认。

## 4. 做市商购买 SPACE

后台检查：

```text
account.is_market_maker = true
做市商USDT余额充足
回购池available_space充足
```

后台数据库事务：

```text
1. 锁定做市商账户
2. 锁定回购池和当天价格状态
3. 根据当天阶梯价格计算USDT
4. 做市商buyback_usdt_balance -= usdtAmount
5. 如果手续费补贴开启，计算 subsidySpace = spaceAmount × SUBSIDY_BP / 10000
6. 做市商buyback_space_balance += spaceAmount + subsidySpace
7. 回购池available_space -= spaceAmount + subsidySpace
8. 成交USDT的5/6进入available_usdt
9. 成交USDT的1/6进入配置的指定账户回购USDT余额
10. 更新当天做市商购买累计数量（不包含补贴数量）
11. 写入购买数量和补贴数量
```

数据库事务提交后立即返回成功，不需要链上签名和 nonce。

## 5. 每日阶梯价格

### 用户卖出价格

配置项：

```text
SELL_DEFAULT_PRICE   每天默认卖出价格
SELL_STEP_AMOUNT     n：累计卖出多少SPACE触发一档
SELL_STEP_DECREASE   m：每档下降多少价格
SELL_MIN_PRICE       最低卖出价格
SELL_FEE_BP          用户卖出手续费比例，10000表示100%
```

价格规则：

```text
卖出价格
= SELL_DEFAULT_PRICE
 - floor(当天累计卖出SPACE / n) × m
```

最终价格不能低于 `SELL_MIN_PRICE`。

### 做市商买入价格

配置项：

```text
MAKER_DEFAULT_PRICE   每天默认买入价格
MAKER_STEP_AMOUNT     x：累计买入多少SPACE触发一档
MAKER_STEP_INCREASE   y：每档上涨多少价格
MAKER_MAX_PRICE       最高买入价格
MAKER_FEE_SUBSIDY_ENABLED  手续费补贴开关
MAKER_FEE_SUBSIDY_BP       额外SPACE补贴比例，默认1000，即10%
```

价格规则：

```text
做市商买入价格
= MAKER_DEFAULT_PRICE
 + floor(当天累计买入SPACE / x) × y
```

最终价格不能高于 `MAKER_MAX_PRICE`。

### 跨档交易

大额交易如果跨越价格档位，应分段计算，避免通过单笔大额交易绕过价格变化。

例如：

```text
默认卖出价格：1 USDT
n：100 SPACE
m：0.01 USDT
当天已卖出：80 SPACE
本次卖出：50 SPACE

前20 SPACE按1 USDT计算
后30 SPACE按0.99 USDT计算
```

后台返回本次交易的总金额和平均成交价格。

## 6. 每日重置

每天 `00:00` 按 `Asia/Shanghai` 时区重置：

```text
当天用户卖出累计数量 = 0
当天做市商买入累计数量 = 0
用户卖出价格恢复SELL_DEFAULT_PRICE
做市商买入价格恢复MAKER_DEFAULT_PRICE
```

实现方式：

- 定时任务每天凌晨主动重置。
- 每笔交易执行前再次检查业务日期。
- 如果数据库日期不是当天，交易事务内先重置再计算价格。

这样即使定时任务失败，第一笔交易也会自动恢复默认价格。

后台配置修改后立即用于后续交易；每天重置的是累计成交数量，不修改配置本身。

## 7. 提现

### SPACE 提现

```text
预扣buyback_space_balance
生成Mining.claim签名
vipFee = 0
nodeFee = 0
用户调用Mining.claim
```

nonce 已使用时标记成功；签名过期未使用时退回 `buyback_space_balance`。

### USDT 提现

```text
预扣buyback_usdt_balance
生成Mining.withdrawUsdt签名
用户调用Mining.withdrawUsdt
```

USDT 提现不收手续费。nonce 未使用且签名过期时退回 `buyback_usdt_balance`。

## 8. nonce 同步

充值和提现沿用矿机购买体验：

```text
获取后台签名
→ 发起链上交易
→ 等待交易回执
→ 提交nonce
→ BullMQ立即检查nonce
→ 前端轮询状态
→ 定时任务兜底
```

内部卖出和做市商购买是数据库交易，不需要 nonce。

## 9. 数据库状态

至少记录：

```text
用户buyback_space_balance
用户buyback_usdt_balance
回购池available_space
回购池available_usdt
当天用户卖出累计SPACE
当天做市商买入累计SPACE
当前业务日期
充值签名及状态
提现签名及状态
内部交易流水
```

余额、池额度和每日累计数量的修改必须在同一个数据库事务中完成，并锁定账户、回购池和当天价格状态。
