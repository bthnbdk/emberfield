/** Tiny pooled Web Audio synth: short blips for shoot/hit/kill/gameover.
 *  Every sound is a brief oscillator envelope; no assets, no leaks. */
export class AudioSystem {
  private context: AudioContext | null = null;
  private unlocked = false;
  private lastShootAt = 0;
  muted = false;

  /** Toggle mute; returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  constructor() {
    const unlock = () => {
      void this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    await this.context.resume();
    this.unlocked = true;
  }

  /** Throttled so heavy fire rates cannot spawn hundreds of voices. */
  shoot(): void {
    if (!this.context || this.context.state !== 'running') return;
    const now = performance.now();
    if (now - this.lastShootAt < 40) return;
    this.lastShootAt = now;
    this.blip(180, 620, 0.09, 0.045, 'square');
  }

  hit(): void {
    this.blip(140, 90, 0.12, 0.05, 'sawtooth');
  }

  enemyShoot(): void {
    this.blip(520, 240, 0.14, 0.035, 'sawtooth');
  }

  dash(): void {
    this.blip(180, 520, 0.16, 0.06, 'square');
  }

  kill(): void {
    this.blip(220, 440, 0.1, 0.035, 'triangle');
  }

  gameOver(): void {
    this.blip(330, 66, 0.5, 0.09, 'sawtooth');
  }

  levelUp(): void {
    this.blip(420, 880, 0.18, 0.06, 'triangle');
    this.blip(560, 1120, 0.16, 0.04, 'triangle');
  }

  pickup(): void {
    this.blip(880, 1320, 0.07, 0.03, 'sine');
  }

  weaponSwitch(): void {
    this.blip(240, 480, 0.12, 0.05, 'square');
  }

  shopOpen(): void {
    this.blip(300, 600, 0.2, 0.05, 'triangle');
    this.blip(450, 900, 0.18, 0.04, 'triangle');
  }

  buy(): void {
    this.blip(520, 1040, 0.14, 0.06, 'triangle');
    this.blip(780, 1560, 0.18, 0.05, 'triangle');
  }

  error(): void {
    this.blip(180, 90, 0.16, 0.06, 'sawtooth');
  }

  boss(): void {
    this.blip(110, 55, 0.7, 0.1, 'sawtooth');
    this.blip(160, 80, 0.7, 0.08, 'sawtooth');
  }

  bossDown(): void {
    this.blip(220, 440, 0.25, 0.08, 'triangle');
    this.blip(330, 660, 0.3, 0.07, 'triangle');
    this.blip(440, 880, 0.4, 0.06, 'triangle');
  }

  private blip(from: number, to: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
  }
}
