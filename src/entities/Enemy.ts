import * as THREE from 'three';

export type EnemyDefinition = {
  id: string;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  xpValue: number;
  /** Gold dropped on death. */
  goldValue: number;
  /** Visual scale multiplier (bosses/brutes are bigger). */
  scale: number;
  /** Bosses show a dedicated HUD bar. */
  boss?: boolean;
  /** Ranged attackers stop at a distance and lob projectiles. */
  ranged?: boolean;
  /** Preferred engagement distance for ranged enemies. */
  range?: number;
  /** Seconds between ranged shots. */
  fireInterval?: number;
};

/** Pooled enemy: chases the player, deals contact damage on a cooldown.
 *  Supports mixed sizes (wisp/brute/boss) via per-spawn scale. */
export class Enemy {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  active = false;
  hp = 1;
  speed = 2.5;
  damage = 8;
  radius = 0.45;
  xpValue = 1;
  goldValue = 1;
  boss = false;
  name = 'Cinder';
  /** Ranged enemy state (reads definition at spawn). */
  ranged = false;
  range = 6;
  fireInterval = 2.2;
  /** Fired when a ranged enemy wants to shoot; consumed by the game layer. */
  readonly onFire = { fired: false, dirX: 0, dirZ: 0 };
  private rangedCooldown = 0;

  private readonly bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.42, 4, 8);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.05,
  });
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({
    color: '#ffe9c9',
    emissive: '#ff9d3f',
    emissiveIntensity: 1.1,
    roughness: 0.3,
  });
  private readonly eyeGeometry = new THREE.SphereGeometry(0.09, 6, 6);
  private readonly eye: THREE.Mesh;
  private readonly target = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private attackCooldown = 0;
  private hitFlashTimer = 0;
  private bobPhase = 0;

  constructor() {
    this.mesh = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    this.mesh.castShadow = true;
    this.mesh.position.y = 0.5;
    this.group.add(this.mesh);

    // Single glowing eye so enemies read as "alive" even at small sizes.
    this.eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial);
    this.eye.position.set(0, 0.5, 0.3);
    this.group.add(this.eye);

    this.group.visible = false;
  }

  spawn(definition: EnemyDefinition, position: THREE.Vector3): void {
    this.bodyMaterial.color.set(definition.color);
    this.hp = definition.maxHp;
    this.speed = definition.speed;
    this.damage = definition.damage;
    this.radius = definition.radius;
    this.xpValue = definition.xpValue;
    this.goldValue = definition.goldValue;
    this.boss = definition.boss ?? false;
    this.name = definition.name;
    this.ranged = definition.ranged ?? false;
    this.range = definition.range ?? 6;
    this.fireInterval = definition.fireInterval ?? 2.2;
    this.rangedCooldown = 0.8 + Math.random() * 0.6;
    this.onFire.fired = false;
    this.group.position.copy(position);
    this.group.position.y = 0.05;
    this.group.scale.setScalar(definition.scale);
    this.group.visible = true;
    this.active = true;
    this.attackCooldown = 0;
    this.hitFlashTimer = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.mesh.position.y = 0.5;
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.hitFlashTimer = 0.12;
    if (this.hp <= 0) this.active = false;
  }

  /** Returns true while this enemy is alive. */
  update(delta: number, playerPos: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - delta);
    this.rangedCooldown = Math.max(0, this.rangedCooldown - delta);

    // Chase player on the XZ plane.
    this.target.copy(playerPos);
    this.target.y = 0;
    this.dir.copy(this.target).sub(this.group.position);
    this.dir.y = 0;
    const dist = this.dir.length();
    if (dist > 0.01) {
      this.dir.divideScalar(dist);
    }

    if (this.ranged) {
      // Stop at preferred range, back off if too close, and lob projectiles.
      if (dist > this.range) {
        this.group.position.addScaledVector(this.dir, this.speed * delta);
      } else if (dist < this.range * 0.55) {
        this.group.position.addScaledVector(this.dir, -this.speed * 0.7 * delta);
      }
      if (dist <= this.range * 1.35 && this.rangedCooldown <= 0) {
        this.rangedCooldown = this.fireInterval;
        this.onFire.fired = true;
        this.onFire.dirX = this.dir.x;
        this.onFire.dirZ = this.dir.z;
      }
    } else if (dist > 0.01) {
      this.group.position.addScaledVector(this.dir, this.speed * delta);
    }
    if (dist > 0.1) {
      this.group.rotation.y = Math.atan2(this.dir.x, -this.dir.z);
    }

    // Bob + hit flash (redden material when damaged).
    this.bobPhase += delta * 7;
    this.mesh.position.y = 0.5 + Math.sin(this.bobPhase) * 0.06;
    if (this.hitFlashTimer > 0) {
      this.bodyMaterial.emissive.set('#ff4444');
      this.bodyMaterial.emissiveIntensity = 0.7;
    } else {
      this.bodyMaterial.emissive.set('#000000');
      this.bodyMaterial.emissiveIntensity = 0;
    }
    return true;
  }

  /** Call when the enemy has finished attacking (reset cooldown). */
  tryAttack(): boolean {
    if (this.attackCooldown > 0) return false;
    this.attackCooldown = this.boss ? 1.1 : 0.8;
    return true;
  }

  despawn(): void {
    this.active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.bodyGeometry.dispose();
    this.bodyMaterial.dispose();
    this.eyeGeometry.dispose();
    this.eyeMaterial.dispose();
  }
}
