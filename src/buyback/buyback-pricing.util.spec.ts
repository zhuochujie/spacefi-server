import {
  calculateMakerBuyQuote,
  calculateUserSellQuote,
  getMakerBuyPrice,
  getUserSellPrice,
  type MakerBuyPricingConfig,
  type UserSellPricingConfig,
} from './buyback-pricing.util';

const WEI = 10n ** 18n;
const space = (value: number) => BigInt(value) * WEI;
const price = (hundredths: number) => (BigInt(hundredths) * WEI) / 100n;

const userConfig: UserSellPricingConfig = {
  defaultPrice: price(20),
  tier1EndAmount: space(5_000),
  tier1StepAmount: space(500),
  tier1StepDecrease: price(1),
  tier2EndAmount: space(10_000),
  tier2StepAmount: space(1_000),
  tier2StepDecrease: price(1),
  fixedPrice: price(5),
  dailyMaxAmount: space(30_000),
  tier1BurnBp: 2_500n,
  tier2BurnBp: 5_000n,
  tier3BurnBp: 8_000n,
};

const makerConfig: MakerBuyPricingConfig = {
  defaultPrice: price(50),
  firstStepAmount: space(1_000),
  firstStepIncrease: price(10),
  stepAmount: space(1_000),
  stepIncrease: price(1),
};

describe('buyback pricing', () => {
  it.each([
    [0, 20],
    [500, 19],
    [4_500, 11],
    [5_000, 10],
    [6_000, 9],
    [9_000, 6],
    [10_000, 5],
    [29_999, 5],
  ])('prices user sell cursor %s at %s cents', (cursor, cents) => {
    expect(getUserSellPrice(space(cursor), userConfig)).toBe(price(cents));
  });

  it('splits user price and burn tiers in one trade', () => {
    const quote = calculateUserSellQuote(space(6_000), 0n, userConfig);
    expect(quote.totalUsdt).toBe(space(875));
    expect(quote.burnAmount).toBe(space(1_750));
    expect(quote.poolSpaceAmount).toBe(space(4_250));
  });

  it('calculates the complete 30,000 SPACE daily curve', () => {
    const quote = calculateUserSellQuote(space(30_000), 0n, userConfig);
    expect(quote.totalUsdt).toBe(space(2_175));
    expect(quote.burnAmount).toBe(space(19_750));
    expect(quote.poolSpaceAmount).toBe(space(10_250));
  });

  it('rejects user volume above the daily global maximum', () => {
    expect(() =>
      calculateUserSellQuote(space(1), space(30_000), userConfig),
    ).toThrow('BUYBACK_DAILY_GLOBAL_LIMIT_EXCEEDED');
  });

  it.each([
    [0, 50],
    [999, 50],
    [1_000, 60],
    [2_000, 61],
    [3_000, 62],
  ])('prices maker buy cursor %s at %s cents', (cursor, cents) => {
    expect(getMakerBuyPrice(space(cursor), makerConfig)).toBe(price(cents));
  });

  it('splits the maker first price jump', () => {
    const quote = calculateMakerBuyQuote(space(1_500), 0n, makerConfig);
    expect(quote.totalUsdt).toBe(space(800));
  });

  it('continues increasing the maker price without a cap', () => {
    expect(getMakerBuyPrice(space(100_000), makerConfig)).toBe(price(159));
  });
});
