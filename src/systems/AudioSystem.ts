/** Tiny pooled Web Audio synth: short blips for shoot/hit/kill/gameover.
 *  Every sound is a brief oscillator envelope; no assets, no leaks. */
export class AudioSystem {
  private context: AudioContext | null = null;
  private unlocked = false;
  private lastShootAt = 0;

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

  kill(): void {
    this.blip(220, 440, 0.1, 0.035, 'triangle');
  }

  gameOver(): void {
    this.blip(330, 66, 0.5, 0.09, 'sawtooth');
  }

  levelUp(): void {
    this.blip(420, 880, 0.18, 0.06, 'triangle');
  }

  private blip(from: number, to: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context || this.context.state !== 'running') return;
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
