export type MinerCycleConfig = {
  initCycle: number;
  maxCycle: number;
  minerExtendedPerCycle: number;
  cycleRewardBp: bigint;
  rewardStartAt: number;
};

const DAY_SECONDS = 86400;
const BEIJING_OFFSET_SECONDS = 8 * 3600;

export function startOfBeijingDay(timestamp: number) {
  return (
    Math.floor((timestamp + BEIJING_OFFSET_SECONDS) / DAY_SECONDS) *
    DAY_SECONDS -
    BEIJING_OFFSET_SECONDS
  );
}

export function computeCycleEndAt(currentTimestamp: number, cycle: number) {
  return startOfBeijingDay(currentTimestamp) + cycle;
}
