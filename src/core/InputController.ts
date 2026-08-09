import * as THREE from 'three';

type PointerState = {
  active: boolean;
  id: number | null;
  centerX: number;
  centerY: number;
  radius: number;
};

export class InputController {
  private readonly keys = new Set<string>();
  private readonly pointer = new THREE.Vector2();
  private readonly keyVector = new THREE.Vector2();
  private readonly pointerState: PointerState = {
    active: false,
    id: null,
    centerX: 0,
    centerY: 0,
    radius: 1,
  };

  private dashDown = false;
  private dashQueued = false;
  private retryPressed = false;
  private retryConsumed = true;
  private weaponSwitchQueued = false;
  private shopQueued = false;
  private shopConsumed = true;
  private muteQueued = false;
  private muteConsumed = true;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.dashDown = true;
      this.dashQueued = true;
    }
    if (event.code === 'KeyR') {
      this.retryPressed = true;
      this.retryConsumed = false;
    }
    if (event.code === 'KeyQ') {
      this.weaponSwitchQueued = true;
    }
    if (event.code === 'KeyB') {
      this.shopQueued = true;
      this.shopConsumed = false;
    }
    if (event.code === 'KeyM') {
      this.muteQueued = true;
      this.muteConsumed = false;
    }
    if (/^(Digit|Numpad)[1-3]$/.test(event.code)) {
      this.digitQueue.push(Number(event.code.slice(-1)) - 1);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.dashDown = false;
    }
  };

  private readonly onStickDown = (event: PointerEvent) => {
    event.preventDefault();
    const rect = this.stick.getBoundingClientRect();
    this.pointerState.active = true;
    this.pointerState.id = event.pointerId;
    this.pointerState.centerX = rect.left + rect.width / 2;
    this.pointerState.centerY = rect.top + rect.height / 2;
    this.pointerState.radius = rect.width * 0.42;
    try {
      this.stick.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic test events do not always have a capturable pointer id.
    }
    this.updatePointer(event.clientX, event.clientY);
  };

  private readonly onStickMove = (event: PointerEvent) => {
    if (!this.pointerState.active || event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.updatePointer(event.clientX, event.clientY);
  };

  private readonly onStickUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.pointerState.active = false;
    this.pointerState.id = null;
    this.pointer.set(0, 0);
    this.updateKnob();
  };

  private readonly onDashDown = (event: PointerEvent) => {
    event.preventDefault();
    this.dashDown = true;
    this.dashQueued = true;
  };

  private readonly onDashUp = (event: PointerEvent) => {
    event.preventDefault();
    this.dashDown = false;
  };

  constructor(
    private readonly stick: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly dashButton: HTMLElement,
    private readonly shopButton: HTMLElement | null = null,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.stick.addEventListener('pointerdown', this.onStickDown);
    this.stick.addEventListener('pointermove', this.onStickMove);
    this.stick.addEventListener('pointerup', this.onStickUp);
    this.stick.addEventListener('pointercancel', this.onStickUp);
    this.dashButton.addEventListener('pointerdown', this.onDashDown);
    this.dashButton.addEventListener('pointerup', this.onDashUp);
    this.dashButton.addEventListener('pointercancel', this.onDashUp);
    this.dashButton.addEventListener('pointerleave', this.onDashUp);
    if (this.shopButton) {
      this.shopButton.addEventListener('pointerdown', this.onShopDown);
      this.shopButton.addEventListener('pointerup', this.onShopUp);
      this.shopButton.addEventListener('pointercancel', this.onShopUp);
    }
  }

  private readonly onShopDown = (event: PointerEvent) => {
    event.preventDefault();
    this.shopQueued = true;
    this.shopConsumed = false;
  };

  private readonly onShopUp = (event: PointerEvent) => {
    event.preventDefault();
  };

  readMovement(target: THREE.Vector2): THREE.Vector2 {
    this.keyVector.set(0, 0);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.keyVector.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.keyVector.x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.keyVector.y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.keyVector.y += 1;

    target.copy(this.keyVector).add(this.pointer);
    if (target.lengthSq() > 1) target.normalize();
    return target;
  }

  isDashHeld(): boolean {
    return this.dashDown;
  }

  /** Edge-triggered dash intent (Space/Shift/touch). Consumed once per press. */
  consumeDash(): boolean {
    if (this.dashQueued) {
      this.dashQueued = false;
      return true;
    }
    return false;
  }

  /** Edge-triggered mute toggle (M). Returns true once per press. */
  consumeMute(): boolean {
    if (this.muteQueued && !this.muteConsumed) {
      this.muteConsumed = true;
      return true;
    }
    return false;
  }

  /** Edge-triggered weapon cycle (Q). Consumed once per press. */
  consumeWeaponSwitch(): boolean {
    if (this.weaponSwitchQueued) {
      this.weaponSwitchQueued = false;
      return true;
    }
    return false;
  }

  /** Edge-triggered shop open (B). Returns true once per press. */
  consumeShopOpen(): boolean {
    if (this.shopQueued && !this.shopConsumed) {
      this.shopConsumed = true;
      return true;
    }
    return false;
  }

  /** Edge-triggered retry intent (R key). Returns true once per press. */
  consumeRetry(): boolean {
    if (this.retryPressed && !this.retryConsumed) {
      this.retryConsumed = true;
      return true;
    }
    return false;
  }

  private readonly digitQueue: number[] = [];

  /** Consume the latest level-up pick (Digit1/2/3 or Numpad1/2/3). */
  consumeDigitPick(): number | null {
    return this.digitQueue.shift() ?? null;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.stick.removeEventListener('pointerdown', this.onStickDown);
    this.stick.removeEventListener('pointermove', this.onStickMove);
    this.stick.removeEventListener('pointerup', this.onStickUp);
    this.stick.removeEventListener('pointercancel', this.onStickUp);
    this.dashButton.removeEventListener('pointerdown', this.onDashDown);
    this.dashButton.removeEventListener('pointerup', this.onDashUp);
    this.dashButton.removeEventListener('pointercancel', this.onDashUp);
    this.dashButton.removeEventListener('pointerleave', this.onDashUp);
    if (this.shopButton) {
      this.shopButton.removeEventListener('pointerdown', this.onShopDown);
      this.shopButton.removeEventListener('pointerup', this.onShopUp);
      this.shopButton.removeEventListener('pointercancel', this.onShopUp);
    }
  }

  private updatePointer(clientX: number, clientY: number): void {
    const dx = clientX - this.pointerState.centerX;
    const dy = clientY - this.pointerState.centerY;
    this.pointer.set(dx / this.pointerState.radius, dy / this.pointerState.radius);
    if (this.pointer.lengthSq() > 1) this.pointer.normalize();
    this.updateKnob();
  }

  private updateKnob(): void {
    const distance = 38;
    this.knob.style.transform = `translate(calc(-50% + ${this.pointer.x * distance}px), calc(-50% + ${this.pointer.y * distance}px))`;
  }
}
