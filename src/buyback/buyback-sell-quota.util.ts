const WEI = 10n ** 18n;
const SELL_QUOTA_USDT_STEP = 10_000n * WEI;
const SELL_QUOTA_MIN_RATE_BP = 100n;
const SELL_QUOTA_MAX_RATE_BP = 1_000n;

export function calculateSellQuotaRateBp(availableUsdt: bigint) {
  const calculatedRateBp = (availableUsdt / SELL_QUOTA_USDT_STEP) * 100n;

  if (calculatedRateBp < SELL_QUOTA_MIN_RATE_BP) {
    return SELL_QUOTA_MIN_RATE_BP;
  }
  if (calculatedRateBp > SELL_QUOTA_MAX_RATE_BP) {
    return SELL_QUOTA_MAX_RATE_BP;
  }
  return calculatedRateBp;
}
