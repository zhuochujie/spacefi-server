# 前端对接文档

本文档基于当前后端代码整理。所有金额类字段都使用链上最小单位字符串传输，前端不要用 `number` 承接，统一使用 `string` / `bigint`。

## 基础约定

### Base URL

开发环境示例：

```txt
http://localhost:3000
```

### 统一响应

成功响应：

```json
{
  "success": true,
  "code": 200,
  "data": {},
  "message": "Success",
  "timestamp": 1710000000000
}
```

失败响应：

```json
{
  "success": false,
  "code": 400,
  "message": "ORDER_NOT_FOUND",
  "timestamp": 1710000000000,
  "path": "/api/path"
}
```

说明：

- `message` 返回稳定错误码字符串，前端可直接作为 i18n key 使用。
- `code` 是 HTTP 状态码。

### 错误码

认证：

| message | HTTP 状态码 | 说明 |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | 未登录、Token 缺失或 Token 无效 |
| `INVALID_SIGNATURE` | 401 | 钱包签名校验失败 |
| `NONCE_NOT_FOUND` | 401 / 404 | Nonce 不存在或已失效 |

账户：

| message | HTTP 状态码 | 说明 |
| --- | --- | --- |
| `ACCOUNT_ALREADY_EXISTS` | 409 | 账户已存在 |
| `ACCOUNT_NOT_FOUND` | 404 | 账户不存在 |
| `REF_CODE_NOT_FOUND` | 404 | 推荐码不存在 |
| `NODE_LEVEL_TOO_LOW` | 403 | 节点等级不足 |
| `INVALID_WITHDRAW_AMOUNT` | 400 | 提现金额错误 |
| `INSUFFICIENT_BALANCE` | 409 | 余额不足 |

矿机：

| message | HTTP 状态码 | 说明 |
| --- | --- | --- |
| `MINER_NOT_FOUND` | 404 | 矿机不存在 |
| `MINER_NOT_EXPIRED` | 409 | 当前矿机未到期，不能复投 |
| `PENDING_PURCHASE_SIGNATURE_EXISTS` | 409 | 已有待确认购买签名，不能更换支付方式 |
| `MINER_OUT_OF_STOCK` | 409 | 矿机库存不足 |
| `INVALID_PURCHASE_METHOD` | 400 | 购买方式错误 |
| `RETRY_AFTER_5_MINUTES` | 409 | 请稍后重试 |
| `INVALID_MINER_STATUS` | 500 | 矿机状态异常 |

市场：

| message | HTTP 状态码 | 说明 |
| --- | --- | --- |
| `ORDER_ALREADY_EXISTS` | 409 | 订单已存在 |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `FILL_AMOUNT_EXCEEDS_REMAINING` | 409 | 成交数量超过订单剩余数量 |
| `INVALID_ORDER_SIDE` | 400 | 订单方向错误 |
| `INVALID_ORDER_STATUS` | 400 | 订单状态错误 |
| `MARKET_EVENT_NOT_FOUND` | 400 | 交易 hash 中未找到市场订单事件 |

配置 / 系统：

| message | HTTP 状态码 | 说明 |
| --- | --- | --- |
| `INVALID_WITHDRAW_FEE_CONFIG` | 500 | 提现手续费配置错误 |
| `CONFIG_NOT_FOUND` | 500 | 配置不存在 |
| `INVALID_CONFIG_FORMAT` | 500 | 配置格式错误 |
| `CONFIG_EXCEEDS_LIMIT` | 500 | 配置超过上限 |
| `DIVIDEND_ACCOUNT_NOT_FOUND` | 500 | 分红账户不存在 |
| `UNKNOWN_ERROR` | 500 | 未知服务端错误 |

### 鉴权

除标记为公开接口的接口外，都需要带 JWT：

```http
Authorization: Bearer <access_token>
```

Token 有效期：`600000s`。

### 地址和金额

- 地址：后端会统一转换为小写。
- 金额：全部是整数 `string`，单位是 token 最小单位。
- 时间：全部是秒级 Unix 时间戳。

## 公告

### 查询最新公告

授权：需要登录。

```http
GET /notice/latest
```

返回：

```json
{
  "data": {
    "id": 1,
    "title": "公告标题",
    "content": "公告内容",
    "englishTitle": "Notice title",
    "englishContent": "Notice content",
    "createTime": 1710000000
  }
}
```

如果没有公告：

```json
{
  "data": null
}
```

### 查询公告列表

授权：需要登录。

```http
GET /notice?page=1&pageSize=20
```

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `page` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `100` |

返回：

```json
{
  "data": {
    "list": [
      {
        "id": 1,
        "title": "公告标题",
        "content": "公告内容",
        "englishTitle": "Notice title",
        "englishContent": "Notice content",
        "createTime": 1710000000
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

## 登录注册

### 获取 Nonce

授权：公开。

```http
GET /nonce/:address
```

参数：

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `address` | path | 钱包地址 |

返回：

```json
{
  "data": "nonce字符串"
}
```

### 登录

授权：公开。

```http
POST /auth/login
```

请求体：

```json
{
  "address": "0x...",
  "signature": "0x..."
}
```

签名消息：

```txt
Sign this message to login your account.

Address: <address>
Nonce: <nonce>
```

返回：

```json
{
  "data": {
    "access_token": "jwt"
  }
}
```

### 注册

授权：公开。

```http
POST /auth/register
```

请求体：

```json
{
  "address": "0x...",
  "refCode": "WOCCY0RJ",
  "signature": "0x..."
}
```

签名消息：

```txt
Sign this message to register your account.

Address: <address>
Nonce: <nonce>
Referral Code: <refCode>
```

返回：

```json
{
  "data": {
    "access_token": "jwt"
  }
}
```

### 用户信息

授权：需要登录。

```http
GET /auth/profile
```

返回：

```json
{
  "data": {
    "id": 1,
    "address": "0x...",
    "refCode": "ABCDEFGH",
    "vipLevel": 0,
    "nodeLevel": 0,
    "balance": "0",
    "usdtBalance": "0",
    "createdAt": 1710000000
  }
}
```

### 查询账户是否存在

授权：公开。

```http
GET /auth/account/:address/exists
```

参数：

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `address` | path | 钱包地址 |

返回：

```json
{
  "data": {
    "exists": true
  }
}
```

## 账户

### 查询佣金等级

授权：需要登录。

```http
GET /account/commission-level
```

返回：

```json
{
  "data": {
    "commissionLevel": 0
  }
}
```

### 查询资金记录

授权：需要登录。

```http
GET /account/balance-logs?page=1&pageSize=20&type=miner_reward&type=team_reward
```

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `page` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `100` |
| `type` | 否 | 资金记录类型，可传多个：`type=a&type=b` 或 `type=a,b` |
| `token` | 否 | 代币类型：`SPACE` / `USDT` |

`type` 可选值：

```txt
miner_reward
team_reward
miner_purchase
miner_purchase_refund
withdraw
withdraw_refund
vip_dividend
node_dividend
```

返回：

```json
{
  "data": {
    "list": [
      {
        "id": 1,
        "accountId": 1,
        "type": "miner_reward",
        "token": "SPACE",
        "amount": "1000000000000000000",
        "balanceBefore": "0",
        "balanceAfter": "1000000000000000000",
        "createdAt": 1710000000
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### 查询团队数据

授权：需要登录。

```http
GET /account/team
```

返回直推列表，以及每个直推分支业绩。分支业绩包括直推本人和直推下面团队成员的购买矿机 `price` 总和。

```json
{
  "data": {
    "directList": [
      {
        "id": 2,
        "address": "0x...",
        "refCode": "ABCDEFGH",
        "vipLevel": 1,
        "performance": "3000000000000000000000",
        "createdAt": 1710000000
      }
    ],
    "directCount": 1,
    "totalPerformance": "3000000000000000000000"
  }
}
```

### 同步节点等级

授权：需要登录。

```http
POST /account/sync-node-level
```

后端会读取链上节点等级，并只在链上等级更高时更新数据库。

返回：

```json
{
  "data": 4
}
```

### 领取市场手续费免除签名

授权：需要登录。

```http
POST /account/claim-fee-exempt
```

要求：当前用户 `nodeLevel >= 4`。

返回：

```json
{
  "data": {
    "account": "0x...",
    "exempt": true,
    "nonce": "0",
    "signature": "0x..."
  }
}
```

说明：

- `nonce` 来自市场合约 `feeExemptNonces(account)`。
- 后端签名 digest 包含 `account`、`exempt` 和当前链上 `nonce`。

前端拿到后调用市场合约：

```ts
setFeeExempt(account, true, signature)
```

### 生成提现签名

授权：需要登录。

```http
POST /account/withdraw
```

请求体：

```json
{
  "amount": "1000000000000000000"
}
```

说明：

- `amount` 是提现总额。
- 链上用户到账金额由合约扣除 `vipFee` 和 `nodeFee` 后决定。
- 后端会预扣账户余额 `amount`。
- 签名过期且链上未使用时，定时任务会自动退款。

返回：

```json
{
  "data": {
    "amount": "1000000000000000000",
    "vipFee": "0",
    "nodeFee": "0",
    "nonce": "uuid",
    "deadline": 1710000300,
    "signature": "0x..."
  }
}
```

前端拿到后调用矿机合约：

```ts
claim(amount, vipFee, nodeFee, nonce, deadline, signature)
```

### 生成 USDT 提现签名

授权：需要登录。

```http
POST /account/withdraw-usdt
```

请求体：

```json
{
  "amount": "1000000000000000000"
}
```

说明：

- `amount` 是 USDT 提现金额。
- 后端会预扣账户 `usdtBalance`。
- 签名过期且链上未使用时，定时任务会自动退回 `usdtBalance`。
- USDT 提现不计算 `vipFee` / `nodeFee`。

返回：

```json
{
  "data": {
    "amount": "1000000000000000000",
    "nonce": "uuid",
    "deadline": 1710000300,
    "signature": "0x..."
  }
}
```

前端拿到后调用矿机合约：

```ts
withdrawUsdt(account, amount, nonce, deadline, signature)
```

## 矿机

### 查询所有矿机

授权：需要登录。

```http
GET /miner
```

返回：

```json
{
  "data": [
    {
      "id": "1",
      "name": "矿机名称",
      "price": "100000000000000000000",
      "desc": "miner.desc.SPACE_100",
      "expectedReward": "500000000000000000000",
      "remainingQuantity": 100,
      "isPurchasable": true
    }
  ]
}
```

矿机描述 i18n key：

| key | 中文文案 | 英文文案 |
| --- | --- | --- |
| `miner.desc.SPACE_100` | 入门启航，开启您的链上征程 | Start your on-chain journey |
| `miner.desc.SPACE_300` | 稳定运行，持续释放网络价值 | Steady output, lasting value |
| `miner.desc.SPACE_500` | 高效节点，驱动生态持续增长 | Efficient nodes, stronger growth |
| `miner.desc.SPACE_1000` | 链接未来，共建去中心化网络 | Connect and build the network |
| `miner.desc.SPACE_3000` | 智能算力，打造长期稳定收益 | Smart power for steady yield |
| `miner.desc.SPACE_5000` | 强劲性能，释放更多节点潜能 | Strong performance, more potential |
| `miner.desc.SPACE_10000` | 精英配置，助您迈向更高等级 | Elite setup for higher tiers |
| `miner.desc.SPACE_30000` | 旗舰动力，共享未来数字生态 | Flagship power for the ecosystem |
| `miner.desc.SPACE_50000` | 极速连接，让每一次参与更有价值 | Faster access, greater participation |

### 查询当前用户拥有的矿机

授权：需要登录。

```http
GET /miner/my
```

返回：

```json
{
  "data": {
    "list": [
      {
        "id": 1,
        "minerId": "1",
        "accountId": 1,
        "expectedReward": "500000000000000000000",
        "producedReward": "0",
        "cycle": 3024000,
        "cycleEndAt": 1713024000,
        "lastRewardAt": 1710000000,
        "globalExtendedTime": 0,
        "rewardPerSecond": "1000000000000",
        "createdAt": 1710000000,
        "miner": {
          "id": "1",
          "name": "矿机名称",
          "price": "100000000000000000000",
          "desc": "miner.desc.SPACE_100",
          "expectedReward": "500000000000000000000",
          "remainingQuantity": 99,
          "isPurchasable": true
        }
      }
    ],
    "minerReward": "1000000000000000000",
    "teamReward": "30000000000000000"
  }
}
```

### 查询初始购买周期

授权：需要登录。

```http
GET /miner/initial-cycle
```

返回：

```json
{
  "data": 35
}
```

说明：

- 返回单位是天。
- 计算方式：`35天 + 当前全局延长时间`。

### 生成购买矿机签名

授权：需要登录。

```http
POST /miner/purchase
```

请求体：

```json
{
  "minerId": "1",
  "method": "wallet_balance"
}
```

`method` 可选值：

```txt
internal_balance
wallet_balance
internal_and_wallet_balance
```

返回：

```json
{
  "data": {
    "id": 1,
    "accountId": 1,
    "buyer": "0x...",
    "minerId": "1",
    "price": "100000000000000000000",
    "payValue": "100000000000000000000",
    "expectedReward": "500000000000000000000",
    "method": "wallet_balance",
    "nonce": "uuid",
    "deadline": 1710000300,
    "signature": "0x...",
    "status": "pending",
    "createdAt": 1710000000
  }
}
```

前端拿到后调用矿机合约：

```ts
purchaseMiner(minerId, price, payValue, expectedReward, nonce, deadline, signature)
```

调用成功后，前端需要把 `nonce` 提交给后端确认。

### 提交购买矿机 nonce

授权：公开。

```http
POST /miner/nonce
```

请求体：

```json
{
  "nonce": "uuid"
}
```

说明：

- 后端会异步查询链上 `usedPurchaseNonces`。
- 如果链上已使用，会落库购买矿机数据。
- 如果链上未使用，该接口不会退款，会保持 `pending`。
- 过期且链上未使用的签名，由后端定时任务退款。

### 查询购买矿机 nonce 处理状态

授权：需要登录。

```http
GET /miner/nonce/:nonce
```

参数：

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `nonce` | path | 购买矿机签名返回的 UUID nonce |

返回：

```json
{
  "data": {
    "id": 1,
    "accountId": 1,
    "buyer": "0x...",
    "minerId": "1",
    "price": "100000000000000000000",
    "payValue": "100000000000000000000",
    "expectedReward": "500000000000000000000",
    "method": "wallet_balance",
    "nonce": "uuid",
    "deadline": 1710000300,
    "signature": "0x...",
    "status": "pending",
    "createdAt": 1710000000
  }
}
```

如果没有查到：

```json
{
  "data": null
}
```

`status` 含义：

```txt
pending  后端尚未确认链上使用情况
used     链上 nonce 已使用，后端已处理购买成功
unused   签名过期且链上未使用，后端已退款
```

## 市场

### 提交市场交易 hash

授权：公开。

```http
POST /market/hash
```

请求体：

```json
{
  "hash": "0x..."
}
```

说明：

- 交易 hash 必须是 `0x` + 64 位小写 hex。
- 后端会异步解析 `OrderPlaced`、`OrderFilled`、`OrderCancelled` 事件。

### 查询市场 hash 处理状态

授权：需要登录。

```http
GET /market/hash/:hash
```

参数：

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `hash` | path | 市场订单相关链上交易 hash |

返回：

```json
{
  "data": {
    "hash": "0x...",
    "eventCount": 1,
    "createdAt": 1710000000
  }
}
```

如果没有查到：

```json
{
  "data": null
}
```

说明：

- `data = null`：后端还没有处理完成，前端可以继续轮询。
- `data.eventCount > 0`：后端已经解析事件并写入数据库。

### 查询 24 小时市场统计

授权：需要登录。

```http
GET /market/stats/24h
```

返回：

```json
{
  "data": {
    "tradingVolume24h": "100000000000000000000",
    "spaceVolume24h": "1000000000000000000",
    "averagePrice24h": "100000000000000000000",
    "tradeCount24h": "3",
    "since": 1710000000
  }
}
```

说明：

- `tradingVolume24h`：最近 24 小时成交额，来自 `OrderFilled.usdtAmount` 求和。
- `spaceVolume24h`：最近 24 小时成交 SPACE 数量，来自 `OrderFilled.spaceAmount` 求和。
- `averagePrice24h`：最近 24 小时加权平均成交价，计算方式为 `tradingVolume24h * 1e18 / spaceVolume24h`。
- `tradeCount24h`：最近 24 小时成交事件数量。
- 24 小时窗口按链上成交所在区块时间 `filledAt` 计算。

### 查询最新成交价格

授权：需要登录。

```http
GET /market/latest-price
```

返回：

```json
{
  "data": {
    "price": "1000000000000000000",
    "trade": {
      "id": "0x...-12",
      "orderId": "0x...",
      "maker": "0x...",
      "taker": "0x...",
      "side": "sell",
      "spaceAmount": "1000000000000000000",
      "price": "1000000000000000000",
      "usdtAmount": "1000000000000000000",
      "nodeFee": "0",
      "markerFee": "0",
      "transactionHash": "0x...",
      "logIndex": 12,
      "filledAt": 1710000000
    }
  }
}
```

如果还没有成交记录：

```json
{
  "data": {
    "price": "0",
    "trade": null
  }
}
```

说明：

- `price` 是最新一笔成交记录的成交价格，来自 `OrderFilled.price`。
- 最新成交按 `filledAt DESC, id DESC` 排序。

### 查询当前挂单

授权：需要登录。

```http
GET /market/orders?page=1&pageSize=20&side=buy
```

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `page` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `100` |
| `side` | 是 | `buy` 或 `sell` |

返回：

```json
{
  "data": {
    "list": [
      {
        "id": "0x...",
        "maker": "0x...",
        "side": "buy",
        "spaceAmount": "1000000000000000000",
        "remainingSpaceAmount": "1000000000000000000",
        "price": "1000000000000000000",
        "status": "open",
        "visible": true,
        "createdAt": 1710000000
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### 查询我的未成交完挂单

授权：需要登录。

```http
GET /market/my-open-orders?page=1&pageSize=20&side=buy
```

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `page` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `100` |
| `side` | 否 | `buy` 或 `sell` |

说明：

- 只返回当前用户 `maker = 当前登录地址` 且 `status = open` 的订单。
- 会返回当前用户自己的 `visible = false` 订单。

返回结构同 `GET /market/orders`。

### 查询我的订单历史

授权：需要登录。

```http
GET /market/my-orders?page=1&pageSize=20&side=buy&status=open
```

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `page` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `100` |
| `side` | 否 | `buy` 或 `sell` |
| `status` | 否 | `open`、`filled`、`cancelled` |

说明：

- 返回当前用户作为 maker 创建过的订单。
- 不传 `status` 时返回全部状态订单。
- 可用于“我的订单 / 订单历史”页面。

返回结构同 `GET /market/orders`。

### 查询我的吃单记录

授权：需要登录。

```http
GET /market/my-taker-trades?page=1&pageSize=20&side=sell
```

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `page` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `100` |
| `side` | 否 | 被吃订单方向，`buy` 或 `sell` |

说明：

- 返回当前用户作为 taker 的成交记录。
- `side` 表示被成交订单的方向。例如用户吃卖单买入 SPACE 时，记录里的 `side = sell`。

返回：

```json
{
  "data": {
    "list": [
      {
        "id": "0x...-12",
        "orderId": "0x...",
        "maker": "0x...",
        "taker": "0x...",
        "side": "sell",
        "spaceAmount": "1000000000000000000",
        "price": "1000000000000000000",
        "usdtAmount": "1000000000000000000",
        "nodeFee": "0",
        "markerFee": "0",
        "transactionHash": "0x...",
        "logIndex": 12,
        "filledAt": 1710000000
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### 根据订单号查询订单

授权：需要登录。

```http
GET /market/orders/:id
```

参数：

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `id` | path | `bytes32` 订单号，`0x` + 64 位 hex |

说明：该接口可以查询 `visible = false` 的订单。

### 链上市场调用提示

市场订单号现在是 `bytes32`，链上计算方式是：

```solidity
keccak256(bytes(orderIdSource))
```

前端使用 `viem` 本地生成即可，不需要读合约：

```ts
import { keccak256, stringToBytes } from 'viem';

const orderId = keccak256(stringToBytes(orderIdSource));
```

注意：`orderIdSource` 必须保持完全一致，大小写、空格、拼接符变化都会生成不同的 `orderId`。

创建订单：

```ts
placeBuyOrder(orderId, spaceAmount, price, visible)
placeSellOrder(orderId, spaceAmount, price, visible)
```

成交订单：

```ts
fillOrder(orderId, spaceAmount, orderIdSource)
```

取消订单：

```ts
cancelOrder(orderId)
```

链上交易成功后，把交易 hash 提交到：

```http
POST /market/hash
```

## 前端推荐流程

### 登录流程

1. `GET /auth/account/:address/exists` 判断账户是否存在。
2. 如果存在，`GET /nonce/:address`。
3. 使用钱包签名登录消息。
4. `POST /auth/login`。
5. 保存 `access_token`。
6. 后续请求带 `Authorization: Bearer <token>`。

### 注册流程

1. `GET /nonce/:address`
2. 使用钱包签名注册消息。
3. `POST /auth/register`
4. 保存 `access_token`。

### 购买矿机流程

1. `GET /miner` 展示所有矿机，`GET /miner/my` 展示我的矿机。
2. `POST /miner/purchase` 获取签名。
3. 前端调用链上 `purchaseMiner(...)`。
4. 交易成功后 `POST /miner/nonce` 提交 nonce。
5. 轮询 `GET /miner/nonce/:nonce`。
6. `status = used` 后刷新 `GET /miner/my` 和 `GET /auth/profile`。

### 提现流程

1. `POST /account/withdraw` 获取签名。
2. 前端调用链上 `claim(...)`。
3. 后端定时任务自动确认 nonce 是否已使用。
4. 刷新 `GET /auth/profile` 和 `GET /account/balance-logs`。

### 市场订单流程

1. 前端生成或准备 `orderIdSource`。
2. 调链上 `getOrderId(orderIdSource)` 得到 `bytes32 orderId`。
3. 调链上 `placeBuyOrder` / `placeSellOrder` / `fillOrder` / `cancelOrder`。
4. 交易成功后 `POST /market/hash`。
5. 轮询 `GET /market/hash/:hash`。
6. 查到处理记录后刷新 `GET /market/orders`、`GET /market/my-open-orders`、`GET /market/my-orders` 或 `GET /market/orders/:id`。
