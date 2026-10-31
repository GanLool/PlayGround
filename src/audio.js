export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.engineOn = false;
    this.sirenOn = false;
    this.enabled = true;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    const len = Math.floor(this.ctx.sampleRate * 1.5);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this._buildEngine();
    this._buildSiren();
  }

  _buildEngine() {
    const c = this.ctx;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 2;
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineSub = c.createOscillator();
    this.engineSub.type = 'square';
    this.engineSub.frequency.value = 25;
    const subGain = c.createGain();
    subGain.gain.value = 0.45;
    this.engineOsc.connect(this.engineFilter);
    this.engineSub.connect(subGain).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    this.engineSub.start();
  }

  _buildSiren() {
    const c = this.ctx;
    this.sirenGain = c.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc = c.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 620;
    this.sirenLfo = c.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 0.62;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 260;
    this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  update(speed = 0, driving = false, wanted = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const engineLevel = driving ? 0.055 : 0;
    this.engineGain.gain.setTargetAtTime(engineLevel, now, 0.12);
    if (driving) {
      const f = 42 + Math.abs(speed) * 4.2;
      this.engineOsc.frequency.setTargetAtTime(f, now, 0.08);
      this.engineSub.frequency.setTargetAtTime(f * 0.5, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(280 + Math.abs(speed) * 26, now, 0.1);
    }
    const sirenLevel = wanted >= 2 ? 0.022 : 0;
    this.sirenGain.gain.setTargetAtTime(sirenLevel, now, 0.4);
  }

  tone(freq, dur = 0.15, type = 'sine', vol = 0.16, slideTo = null, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  burst(dur = 0.2, vol = 0.3, freq = 1200, type = 'bandpass', q = 1.2, delay = 0, sweepTo = null) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  shot() {
    this.burst(0.09, 0.34, 2100, 'highpass', 0.8);
    this.burst(0.16, 0.24, 700, 'bandpass', 1.1);
    this.tone(120, 0.12, 'square', 0.13, 48);
  }

  punch() {
    this.burst(0.1, 0.22, 380, 'lowpass', 1.2);
    this.tone(90, 0.1, 'sine', 0.16, 50);
  }

  hit() {
    this.burst(0.06, 0.14, 900, 'bandpass', 1.5);
    this.tone(180, 0.06, 'triangle', 0.08, 90);
  }

  pickup() {
    this.tone(660, 0.1, 'triangle', 0.14);
    this.tone(990, 0.16, 'triangle', 0.12, null, 0.08);
  }

  money() {
    this.tone(880, 0.09, 'square', 0.07);
    this.tone(1174, 0.12, 'square', 0.06, null, 0.08);
  }

  star() {
    this.tone(440, 0.12, 'sawtooth', 0.1, 660);
    this.tone(660, 0.18, 'sawtooth', 0.08, 880, 0.1);
  }

  explosion() {
    this.burst(1.0, 0.5, 1400, 'lowpass', 0.8, 0, 55);
    this.burst(0.4, 0.3, 2400, 'bandpass', 0.6);
    this.tone(70, 0.8, 'sine', 0.3, 28);
  }

  horn() {
    this.tone(392, 0.35, 'square', 0.08);
    this.tone(523, 0.35, 'square', 0.06);
  }

  click() {
    this.tone(520, 0.05, 'square', 0.05);
  }

  missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, 0.28, 'triangle', 0.13, null, i * 0.11));
  }

  missionFail() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => this.tone(n, 0.3, 'triangle', 0.12, null, i * 0.13));
  }

  death() {
    this.tone(220, 0.8, 'sawtooth', 0.12, 55);
    this.burst(0.5, 0.2, 500, 'lowpass', 1, 0, 80);
  }

  jump() {
    this.tone(320, 0.1, 'triangle', 0.05, 520);
  }

  enterCar() {
    this.burst(0.08, 0.1, 500, 'lowpass', 1);
    this.tone(120, 0.08, 'square', 0.05);
  }
}
