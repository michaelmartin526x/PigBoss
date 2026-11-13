export const LADDER_LIMIT = 12;
export const LADDER_AWARDS = Object.freeze({4: 4, 8: 4, 12: 10});

// A completed ladder stays complete until the next feature.
export function advanceLadder(before, collectors) {
  const count = Math.min(LADDER_LIMIT, before + collectors);
  const milestones = Object.entries(LADDER_AWARDS)
    .filter(([at]) => Number(at) > before && Number(at) <= count)
    .map(([at, freeSpins]) => ({at: Number(at), freeSpins}));
  return {before, count, collectors, milestones,
    extraSpins: milestones.reduce((total, item) => total + item.freeSpins, 0)};
}
