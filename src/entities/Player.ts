import * as THREE from 'three';
import type { InputController } from '../core/InputController';
import { StatBlock, type UpgradeDefinition } from '../game/Stats';

export type PlayerTuning = {
  speed: number;
  acceleration: number;
};

export type ArenaBounds = {
  halfWidth: number;
  halfDepth: number;
};

const BASE_STATS = {
  damage: 12,
  attackSpeed: 1,
  projectileCount: 1,
  maxHp: 100,
  moveSpeed: 1,
  critChance: 0.05,
  pierce: 0,
  goldBonus: 0,
};

export class Player {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  readonly stats = new StatBlock(BASE_STATS);
  hp = 100;
  radius = 0.55;
  alive = true;
  level = 1;
  xp = 0;
  gold = 0;
  /** Dash impulse active (multiplies speed + grants i-frames). */
  dashTimer = 0;
  dashCooldown = 0;
  /** Events the game layer can react to (VFX/audio). */
  readonly onDash = { fired: false };

  get maxHp(): number {
    return this.stats.get('maxHp');
  }

  get xpToNext(): number {
    // Gentle curve: 6 XP for level 2, then +3 per level.
    return 3 + this.level * 3;
  }

  private readonly move = new THREE.Vector2();
  private readonly targetVelocity = new THREE.Vector3();
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#f5ba49',
    roughness: 0.48,
    metalness: 0.12,
  });
  private readonly accentMaterial = new THREE.MeshStandardMaterial({
    color: '#48baa7',
    roughness: 0.32,
    metalness: 0.18,
    emissive: '#123f39',
    emissiveIntensity: 0.35,
  });
  private readonly bodyGeometry = new THREE.CapsuleGeometry(0.38, 0.58, 6, 12);
  private readonly noseGeometry = new THREE.ConeGeometry(0.22, 0.5, 4);
  private readonly nose: THREE.Mesh;
  private invulnerableTimer = 0;
  private hitFlashTimer = 0;

  constructor() {
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 0.68;
    this.group.add(body);

    this.nose = new THREE.Mesh(this.noseGeometry, this.accentMaterial);
    this.nose.castShadow = true;
    this.nose.position.set(0, 0.68, -0.58);
    this.nose.rotation.x = Math.PI / 2;
    this.group.add(this.nose);
  }

  reset(): void {
    this.group.position.set(0, 0.06, 0);
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.onDash.fired = false;
    this.invulnerableTimer = 0;
    this.hitFlashTimer = 0;
    this.group.visible = true;
  }

  /** Aim point in world space (used for auto-aim/attack direction). */
  get aimOrigin(): THREE.Vector3 {
    return this.group.position.clone().setY(0.68);
  }

  takeDamage(amount: number): void {
    if (!this.alive || this.invulnerableTimer > 0 || this.dashTimer > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableTimer = 0.6;
    this.hitFlashTimer = 0.18;
    if (this.hp <= 0) {
      this.alive = false;
      this.group.visible = false;
    }
  }

  /** Attempt a dash: resets the impulse, grants i-frames. Returns true if it fired. */
  tryDash(): boolean {
    if (!this.alive || this.dashCooldown > 0 || this.dashTimer > 0) return false;
    this.dashTimer = 0.22;
    this.dashCooldown = 2.2;
    this.onDash.fired = true;
    return true;
  }

  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Apply an upgrade's stat effects + optional heal. */
  applyUpgrade(upgrade: UpgradeDefinition): void {
    for (const effect of upgrade.effects) this.stats.apply(effect);
    if (upgrade.heal) this.heal(upgrade.heal);
  }

  /** Add XP; returns the number of level-ups gained. */
  addXp(amount: number): number {
    if (!this.alive) return 0;
    this.xp += amount;
    let levels = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      levels += 1;
    }
    return levels;
  }

  addGold(amount: number): void {
    this.gold += amount;
  }

  /** Returns true if the player can afford `cost` and it is deducted. */
  spendGold(cost: number): boolean {
    if (this.gold < cost) return false;
    this.gold -= cost;
    return true;
  }

  /** Roll a crit: returns the damage multiplier for this shot. */
  rollCrit(): number {
    const chance = Math.min(0.75, this.stats.get('critChance'));
    return Math.random() < chance ? 2 : 1;
  }

  update(delta: number, elapsed: number, input: InputController, tuning: PlayerTuning, bounds: ArenaBounds): void {
    if (!this.alive) return;
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - delta);
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);

    input.readMovement(this.move);
    const baseSpeed = tuning.speed * this.stats.get('moveSpeed');
    // Dash: burst speed along the current input direction (or keep momentum if idle).
    const dashing = this.dashTimer > 0;
    const speed = dashing ? baseSpeed * 3.2 : baseSpeed;
    this.targetVelocity.set(this.move.x, 0, this.move.y).multiplyScalar(speed);
    if (dashing && this.move.lengthSq() < 0.001) {
      // Idle dash: preserve the last non-zero direction so the burst has a vector.
      if (this.velocity.lengthSq() > 0.01) {
        this.targetVelocity.copy(this.velocity).setY(0).normalize().multiplyScalar(speed);
      }
    }

    const smoothing = 1 - Math.exp(-tuning.acceleration * delta);
    this.velocity.lerp(this.targetVelocity, dashing ? 0.35 : smoothing);
    this.group.position.addScaledVector(this.velocity, delta);

    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -bounds.halfWidth + 0.8, bounds.halfWidth - 0.8);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -bounds.halfDepth + 0.8, bounds.halfDepth - 0.8);

    if (this.velocity.lengthSq() > 0.001) {
      this.group.rotation.y = Math.atan2(this.velocity.x, -this.velocity.z);
    }

    this.group.position.y = 0.06 + Math.sin(elapsed * 9) * Math.min(this.velocity.length() / 40, 0.08);

    // Hit flash: blink accent material between teal and red while damaged.
    if (this.hitFlashTimer > 0) {
      this.accentMaterial.emissive.set('#7a1f1f');
      this.accentMaterial.emissiveIntensity = 1.2;
    } else {
      this.accentMaterial.emissive.set('#123f39');
      this.accentMaterial.emissiveIntensity = 0.35;
    }
  }

  dispose(): void {
    this.bodyGeometry.dispose();
    this.noseGeometry.dispose();
    this.bodyMaterial.dispose();
    this.accentMaterial.dispose();
  }
}
