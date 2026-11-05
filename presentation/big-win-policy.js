export const BIG_WIN_THRESHOLD = 20;
export const isBigWin = (awardCents, stakeCents) => awardCents >= BIG_WIN_THRESHOLD * stakeCents;
