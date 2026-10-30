import { calculateSellQuotaRateBp } from './buyback-sell-quota.util';

const WEI = 10n ** 18n;

describe('calculateSellQuotaRateBp', () => {
  it.each([
    [0n, 100n],
    [9_999n * WEI, 100n],
    [10_000n * WEI, 100n],
    [19_999n * WEI, 100n],
    [20_000n * WEI, 200n],
    [99_999n * WEI, 900n],
    [100_000n * WEI, 1_000n],
    [200_000n * WEI, 1_000n],
  ])('returns %s basis points for %s wei', (availableUsdt, expected) => {
    expect(calculateSellQuotaRateBp(availableUsdt)).toBe(expected);
  });
});
