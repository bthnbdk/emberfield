import type { UpgradeDefinition } from '../game/Stats';
import type { WeaponDefinition } from '../data/weapons';

export type GameState = 'playing' | 'levelup' | 'shop' | 'gameover' | 'victory';

export type ShopItemKind = 'weapon' | 'upgrade';

export class Hud {
  private readonly hpValue = this.getElement('#hp-value');
  private readonly hpBar = this.getElement('#hp-bar-fill');
  private readonly waveValue = this.getElement('#wave-value');
  private readonly killsValue = this.getElement('#kills-value');
  private readonly timerValue = this.getElement('#timer-value');
  private readonly levelValue = this.getElement('#level-value');
  private readonly xpBar = this.getElement('#xp-bar-fill');
  private readonly goldValue = this.getElement('#gold-value');
  private readonly weaponValue = this.getElement('#weapon-value');
  private readonly statusLine = this.getElement('#status-line');
  private readonly overlay = this.getElement('#overlay');
  private readonly levelUpPanel = this.getElement('#levelup-panel');
  private readonly levelUpTitle = this.getElement('#levelup-title');
  private readonly levelUpChoices = this.getElement('#levelup-choices');
  private levelUpSelect: ((index: number) => void) | null = null;

  private readonly bossBar = this.getElement('#boss-bar');
  private readonly bossFill = this.getElement('#boss-bar-fill');
  private readonly bossLabel = this.getElement('#boss-label');

  private readonly shopPanel = this.getElement('#shop-panel');
  private readonly shopGold = this.getElement('#shop-gold');
  private readonly shopWeapons = this.getElement('#shop-weapons');
  private readonly shopUpgradeBtn = this.getElement('#shop-upgrade-btn') as HTMLButtonElement;
  private readonly shopUpgradeCost = this.getElement('#shop-upgrade-cost');
  private readonly shopClose = this.getElement('#shop-close');
  private shopBuy: ((kind: ShopItemKind, id: string | null) => void) | null = null;
  private statusFlashTimer = 0;

  setWave(wave: number): void {
    this.waveValue.textContent = String(wave);
  }

  setGold(gold: number): void {
    this.goldValue.textContent = String(gold);
  }

  setWeapon(name: string): void {
    this.weaponValue.textContent = name;
  }

  setBossVisible(visible: boolean, name = ''): void {
    this.bossBar.style.display = visible ? 'block' : 'none';
    if (visible) this.bossLabel.textContent = name;
  }

  setBossHp(ratio: number): void {
    this.bossFill.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
  }

  flashStatus(message: string): void {
    this.statusLine.textContent = message;
    this.statusFlashTimer = 3.2;
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

    if (this.statusFlashTimer > 0) {
      this.statusFlashTimer -= 1 / 60;
      if (this.statusFlashTimer <= 0) {
        this.statusLine.textContent = this.defaultStatus(state);
      }
    } else if (state !== 'levelup' && state !== 'shop') {
      this.statusLine.textContent = this.defaultStatus(state);
    }

    if (state === 'levelup') return;
    if (state === 'shop') return;
    if (state === 'gameover') {
      this.overlay.textContent = 'GAME OVER — press R';
      this.overlay.style.display = 'flex';
    } else if (state === 'victory') {
      this.overlay.textContent = 'VICTORY — press R to play again';
      this.overlay.style.display = 'flex';
    } else {
      this.overlay.style.display = 'none';
    }
  }

  private defaultStatus(state: GameState): string {
    if (state === 'gameover') return 'Game over — press R to retry';
    if (state === 'victory') return 'Victory!';
    return 'Hold out. B opens the shop, Q swaps weapons.';
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

  showShop(
    gold: number,
    weapons: WeaponDefinition[],
    upgradeCost: number,
    onBuy: (kind: ShopItemKind, id: string | null) => void,
    onClose: () => void,
  ): void {
    this.shopBuy = onBuy;
    this.shopGold.textContent = `Gold: ${gold}`;
    this.shopUpgradeCost.textContent = `${upgradeCost}g`;
    this.shopUpgradeBtn.disabled = gold < upgradeCost;

    this.shopWeapons.replaceChildren();
    if (weapons.length === 0) {
      const none = document.createElement('div');
      none.className = 'shop-none';
      none.textContent = 'All weapons owned.';
      this.shopWeapons.append(none);
    }
    weapons.forEach((weapon) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'shop-card';
      card.disabled = gold < weapon.price;
      const name = document.createElement('strong');
      name.textContent = weapon.name;
      const desc = document.createElement('span');
      desc.textContent = weapon.description;
      const price = document.createElement('em');
      price.textContent = `${weapon.price}g`;
      card.append(name, desc, price);
      card.addEventListener('click', () => this.shopBuy?.('weapon', weapon.id));
      this.shopWeapons.append(card);
    });

    this.shopUpgradeBtn.addEventListener('click', () => this.shopBuy?.('upgrade', null));
    this.shopClose.addEventListener('click', () => onClose());
    this.shopPanel.style.display = 'flex';
  }

  hideShop(): void {
    this.shopPanel.style.display = 'none';
    this.shopBuy = null;
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}
