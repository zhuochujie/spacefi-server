export enum BuybackToken {
  Space = 'SPACE',
  Usdt = 'USDT',
}

export enum BuybackSignatureKind {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
}

export enum BuybackSignatureStatus {
  Pending = 'pending',
  Used = 'used',
  Unused = 'unused',
}

export enum BuybackTradeType {
  UserSell = 'user_sell',
  MakerBuy = 'maker_buy',
}

export enum BuybackBalanceLogType {
  Deposit = 'deposit',
  Trade = 'trade',
  Withdraw = 'withdraw',
  WithdrawRefund = 'withdraw_refund',
  FeeIncome = 'fee_income',
}
