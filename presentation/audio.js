export class AudioManager {
  constructor({ createAudio = src => new Audio(src), frame = cb => requestAnimationFrame(cb), now = () => performance.now() } = {}) {
    this.frame = frame;
    this.now = now;
    this.fades = new WeakMap();
    this.masterVolume = 1;
    this.muted = false;
    this.inBase = false;
    this.ambient = createAudio('assets/audio/PigBoss_splash_ambient_loop.mp3');
    this.base = createAudio('assets/audio/PigBoss_basegame_loop.mp3');
    this.levels = new Map([[this.ambient, .28], [this.base, 0]]);
    for (const audio of this.levels.keys()) { audio.preload = 'auto'; audio.loop = true; }
    this.applyVolumes();
  }
  applyVolumes() {
    for (const [audio, level] of this.levels) audio.volume = this.muted ? 0 : level * this.masterVolume;
  }
  setVolume(value) { this.masterVolume = Math.max(0, Math.min(1, Number(value) || 0)); this.applyVolumes(); }
  setMuted(value) { this.muted = !!value; this.applyVolumes(); }
  fade(audio, to, duration = 650, pauseAtEnd = false) {
    const token = (this.fades.get(audio) || 0) + 1;
    this.fades.set(audio, token);
    const start = this.levels.get(audio) || 0, t0 = this.now();
    const tick = now => {
      if (this.fades.get(audio) !== token) return;
      const t = Math.max(0, Math.min(1, (now - t0) / duration));
      this.levels.set(audio, start + (to - start) * t);
      this.applyVolumes();
      if (t < 1) this.frame(tick);
      else if (pauseAtEnd && to === 0) { audio.pause(); audio.currentTime = 0; }
    };
    this.frame(tick);
  }
  async trySplashAmbient() {
    if (this.inBase || !this.ambient.paused) return;
    try {
      await this.ambient.play();
      // A delayed play() may finish after navigation has already happened.
      if (this.inBase) this.fade(this.ambient, 0, 700, true);
    } catch (_) { /* Audio never blocks navigation. */ }
  }
  async enterBase() {
    this.inBase = true;
    this.fade(this.ambient, 0, 700, true);
    try {
      if (this.base.paused) await this.base.play();
      this.fade(this.base, .58, 850);
    } catch (_) { /* A future user gesture can retry playback. */ }
  }
}
