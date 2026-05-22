export const INIT_CYCLE = 35 * 86400;

export type MinerCycleConfig = {
  maxCycle: number;
  minerExtendedPerCycle: number;
  globalExtendedPerCycle: number;
  cycleRewardBp: bigint;
  maxGlobalExtendedCycles: number;
};

const globalStartTimestamp = 1777046400; // 全局周期开始时间
const globalCycle = 180 * 86400; // 全局周期(180天)

export function computeGlobalExtendedTime(
  timestamp: number,
  config: Pick<MinerCycleConfig, 'globalExtendedPerCycle' | 'maxGlobalExtendedCycles'>,
) {
  if (timestamp <= globalStartTimestamp) {
    return 0;
  }

  let completedCycles = Math.floor(
    (timestamp - globalStartTimestamp) / globalCycle,
  );
  completedCycles = completedCycles > config.maxGlobalExtendedCycles
    ? config.maxGlobalExtendedCycles
    : completedCycles;

  return completedCycles * config.globalExtendedPerCycle;
}


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
