import { createRules } from './rules.js';

// Owns result selection and money. Presentation receives immutable spin records.
// All money is stored in integer minor units. No timers or browser APIs belong here.
export class GameEngine {
  constructor(reels, { random = Math.random, creditCents = 100000, stakeCents = 100 } = {}) {
    if (!Number.isSafeInteger(creditCents) || creditCents < 0 ||
        !Number.isSafeInteger(stakeCents) || stakeCents <= 0) throw new Error('Invalid account');
    this.rules = createRules(reels, random);
    this.creditCents = creditCents;
    this.stakeCents = stakeCents;
    this.lastWinCents = 0;
    this.totalStakedCents = 0;
    this.totalReturnedCents = 0;
    this.paidSpins = 0;
    this.featureTotalCents = 0;
    this.freeSpinsLeft = 0;
    this.pendingFreeSpins = 0;
    this.debugFeature = false;
    this.state = 'START';
    this.activeSpin = null;
    this.nextId = 1;
  }
  enterBase() {
    if (this.state !== 'START') return false;
    this.state = 'BASE_GAME';
    return true;
  }
  beginBase({ forced = false } = {}) {
    if (this.state !== 'BASE_GAME' || this.activeSpin) return null;
    if (!forced && this.creditCents < this.stakeCents) return null;
    // Resolution must succeed before money or state changes.
    const resolved = this.rules.resolve(false, forced ? { mode: 'A', stops: [0, 0, 0, 0] } : undefined);
    const record = this.record(resolved, forced, false);
    this.state = 'SPINNING';
    this.activeSpin = record;
    this.lastWinCents = record.awardCents;
    if (!forced) {
      this.creditCents += record.awardCents - this.stakeCents;
      this.totalStakedCents += this.stakeCents;
      this.totalReturnedCents += record.awardCents;
      this.paidSpins++;
    }
    return record;
  }
  completeBase(id) {
    if (this.state !== 'SPINNING' || this.activeSpin?.id !== id) return false;
    const record = this.activeSpin;
    this.activeSpin = null;
    this.pendingFreeSpins = record.result.freeSpins;
    this.debugFeature = record.forced;
    this.state = this.pendingFreeSpins ? 'FEATURE_TRANSITION' : 'BASE_GAME';
    return true;
  }
  showFeatureEntry() {
    if (this.state !== 'FEATURE_TRANSITION') return false;
    this.state = 'FEATURE_ENTRY';
    return true;
  }
  startFeature() {
    if (this.state !== 'FEATURE_ENTRY') return false;
    this.featureTotalCents = 0;
    this.lastWinCents = 0;
    this.freeSpinsLeft = this.pendingFreeSpins;
    this.state = 'FREE_SPINS';
    return true;
  }
  beginFeatureSpin() {
    if (this.state !== 'FREE_SPINS' || this.activeSpin || this.freeSpinsLeft <= 0) return null;
    const record = this.record(this.rules.resolve(true), this.debugFeature, true);
    this.activeSpin = record;
    this.lastWinCents = record.awardCents;
    this.featureTotalCents += record.awardCents;
    this.freeSpinsLeft--;
    // Settle each resolved free spin once; screen dismissal never changes credit.
    if (!record.forced) {
      this.creditCents += record.awardCents;
      this.totalReturnedCents += record.awardCents;
    }
    return record;
  }
  completeFeatureSpin(id) {
    if (this.state !== 'FREE_SPINS' || this.activeSpin?.id !== id) return false;
    this.activeSpin = null;
    if (this.freeSpinsLeft === 0) this.state = 'FEATURE_COMPLETE';
    return true;
  }
  finishFeature() {
    if (this.state !== 'FEATURE_COMPLETE') return false;
    this.lastWinCents = this.featureTotalCents;
    this.debugFeature = false;
    this.state = 'BASE_GAME';
    return true;
  }
  record(resolved, forced, isFeature) {
    const awardCents = Math.round(resolved.result.totalWin * this.stakeCents);
    if (!Number.isSafeInteger(awardCents) || awardCents < 0) throw new Error('Invalid award');
    return deepFreeze({ id: this.nextId++, ...resolved, awardCents, forced, isFeature });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
