const WEI = 10n ** 18n;

export type UserSellPricingConfig = {
  defaultPrice: bigint;
  tier1EndAmount: bigint;
  tier1StepAmount: bigint;
  tier1StepDecrease: bigint;
  tier2EndAmount: bigint;
  tier2StepAmount: bigint;
  tier2StepDecrease: bigint;
  fixedPrice: bigint;
  dailyMaxAmount: bigint;
  tier1BurnBp: bigint;
  tier2BurnBp: bigint;
  tier3BurnBp: bigint;
};

export type MakerBuyPricingConfig = {
  defaultPrice: bigint;
  firstStepAmount: bigint;
  firstStepIncrease: bigint;
  stepAmount: bigint;
  stepIncrease: bigint;
};

const decreaseWithFloor = (value: bigint, amount: bigint, floor: bigint) => {
  const decreased = amount < value ? value - amount : 0n;
  return decreased > floor ? decreased : floor;
};

export function getUserSellPrice(
  cursor: bigint,
  config: UserSellPricingConfig,
) {
  if (cursor < config.tier1EndAmount) {
    return decreaseWithFloor(
      config.defaultPrice,
      (cursor / config.tier1StepAmount) * config.tier1StepDecrease,
      config.fixedPrice,
    );
  }
  if (cursor < config.tier2EndAmount) {
    const tier2StartPrice = decreaseWithFloor(
      config.defaultPrice,
      (config.tier1EndAmount / config.tier1StepAmount) *
        config.tier1StepDecrease,
      config.fixedPrice,
    );
    return decreaseWithFloor(
      tier2StartPrice,
      ((cursor - config.tier1EndAmount) / config.tier2StepAmount) *
        config.tier2StepDecrease,
      config.fixedPrice,
    );
  }
  return config.fixedPrice;
}

export function calculateUserSellQuote(
  amount: bigint,
  initialCursor: bigint,
  config: UserSellPricingConfig,
) {
  if (amount <= 0n || initialCursor + amount > config.dailyMaxAmount) {
    throw new RangeError('BUYBACK_DAILY_GLOBAL_LIMIT_EXCEEDED');
  }

  let remaining = amount;
  let cursor = initialCursor;
  let totalUsdt = 0n;
  let burnAmount = 0n;
  let iterations = 0;

  while (remaining > 0n) {
    if (++iterations > 10_000) throw new RangeError('BUYBACK_AMOUNT_TOO_LARGE');

    let boundary: bigint;
    let burnBp: bigint;
    if (cursor < config.tier1EndAmount) {
      const stepBoundary =
        (cursor / config.tier1StepAmount + 1n) * config.tier1StepAmount;
      boundary =
        stepBoundary < config.tier1EndAmount
          ? stepBoundary
          : config.tier1EndAmount;
      burnBp = config.tier1BurnBp;
    } else if (cursor < config.tier2EndAmount) {
      const offset = cursor - config.tier1EndAmount;
      const stepBoundary =
        config.tier1EndAmount +
        (offset / config.tier2StepAmount + 1n) * config.tier2StepAmount;
      boundary =
        stepBoundary < config.tier2EndAmount
          ? stepBoundary
          : config.tier2EndAmount;
      burnBp = config.tier2BurnBp;
    } else {
      boundary = config.dailyMaxAmount;
      burnBp = config.tier3BurnBp;
    }

    const availableInSegment = boundary - cursor;
    const chunk =
      remaining < availableInSegment ? remaining : availableInSegment;
    totalUsdt += (chunk * getUserSellPrice(cursor, config)) / WEI;
    burnAmount += (chunk * burnBp) / 10_000n;
    remaining -= chunk;
    cursor += chunk;
  }

  return {
    totalUsdt,
    averagePrice: (totalUsdt * WEI) / amount,
    burnAmount,
    poolSpaceAmount: amount - burnAmount,
  };
}

export function getMakerBuyPrice(
  cursor: bigint,
  config: MakerBuyPricingConfig,
) {
  if (cursor < config.firstStepAmount) return config.defaultPrice;
  return (
    config.defaultPrice +
    config.firstStepIncrease +
    ((cursor - config.firstStepAmount) / config.stepAmount) *
      config.stepIncrease
  );
}

export function calculateMakerBuyQuote(
  amount: bigint,
  initialCursor: bigint,
  config: MakerBuyPricingConfig,
) {
  let remaining = amount;
  let cursor = initialCursor;
  let totalUsdt = 0n;
  let iterations = 0;

  while (remaining > 0n) {
    if (++iterations > 10_000) throw new RangeError('BUYBACK_AMOUNT_TOO_LARGE');
    const boundary =
      cursor < config.firstStepAmount
        ? config.firstStepAmount
        : config.firstStepAmount +
          ((cursor - config.firstStepAmount) / config.stepAmount + 1n) *
            config.stepAmount;
    const chunk = remaining < boundary - cursor ? remaining : boundary - cursor;
    totalUsdt += (chunk * getMakerBuyPrice(cursor, config)) / WEI;
    remaining -= chunk;
    cursor += chunk;
  }

  return {
    totalUsdt,
    averagePrice: (totalUsdt * WEI) / amount,
    burnAmount: 0n,
    poolSpaceAmount: 0n,
  };
}
