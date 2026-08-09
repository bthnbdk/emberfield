import type { UpgradeDefinition } from '../game/Stats';

export type GameState = 'playing' | 'levelup' | 'gameover' | 'victory';

export class Hud {
  private readonly hpValue = this.getElement('#hp-value');
  private readonly hpBar = this.getElement('#hp-bar-fill');
  private readonly waveValue = this.getElement('#wave-value');
  private readonly killsValue = this.getElement('#kills-value');
  private readonly timerValue = this.getElement('#timer-value');
  private readonly levelValue = this.getElement('#level-value');
  private readonly xpBar = this.getElement('#xp-bar-fill');
  private readonly statusLine = this.getElement('#status-line');
  private readonly overlay = this.getElement('#overlay');
  private readonly levelUpPanel = this.getElement('#levelup-panel');
  private readonly levelUpTitle = this.getElement('#levelup-title');
  private readonly levelUpChoices = this.getElement('#levelup-choices');
  private levelUpSelect: ((index: number) => void) | null = null;

  setWave(wave: number): void {
    this.waveValue.textContent = String(wave);
  }

  update(
    hp: number,
    maxHp: number,
    level: number,
    xp: number,
    xpToNext: number,
    wave: number,
    kills: number,
    elapsed: number,
    state: GameState,
  ): void {
    this.hpValue.textContent = `${Math.max(0, Math.ceil(hp))}/${Math.round(maxHp)}`;
    this.hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.waveValue.textContent = String(wave);
    this.killsValue.textContent = String(kills);
    this.levelValue.textContent = String(level);
    this.xpBar.style.width = `${Math.min(100, (xp / xpToNext) * 100)}%`;
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsed % 60).toString().padStart(2, '0');
    this.timerValue.textContent = `${minutes}:${seconds}`;

    if (state === 'levelup') return; // panel handles its own display
    if (state === 'gameover') {
      this.statusLine.textContent = 'Game over — press R to retry';
      this.overlay.textContent = 'GAME OVER — press R';
      this.overlay.style.display = 'flex';
    } else if (state === 'victory') {
      this.statusLine.textContent = 'Victory!';
      this.overlay.textContent = 'VICTORY — press R to play again';
      this.overlay.style.display = 'flex';
    } else {
      this.statusLine.textContent = 'Hold out. Auto-aim fires at the nearest cinder.';
      this.overlay.style.display = 'none';
    }
  }

  showLevelUp(choices: UpgradeDefinition[], onSelect: (index: number) => void): void {
    this.levelUpSelect = onSelect;
    this.levelUpTitle.textContent = `LEVEL UP — pick one`;
    this.levelUpChoices.replaceChildren();
    choices.forEach((upgrade, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'levelup-choice';
      button.dataset.index = String(index);
      const name = document.createElement('strong');
      name.textContent = `${index + 1}. ${upgrade.name}`;
      const desc = document.createElement('span');
      desc.textContent = upgrade.description;
      button.append(name, desc);
      button.addEventListener('click', () => this.levelUpSelect?.(index));
      this.levelUpChoices.append(button);
    });
    this.levelUpPanel.style.display = 'flex';
  }

  hideLevelUp(): void {
    this.levelUpPanel.style.display = 'none';
    this.levelUpSelect = null;
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}
