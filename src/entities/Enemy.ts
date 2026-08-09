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
};

/** Simple pooled enemy: chases the player, deals contact damage on a cooldown. */
export class Enemy {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  active = false;
  hp = 1;
  speed = 2.5;
  damage = 8;
  radius = 0.45;
  xpValue = 1;

  private readonly bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.42, 4, 8);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.05,
  });
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
    this.group.visible = false;
  }

  spawn(definition: EnemyDefinition, position: THREE.Vector3): void {
    this.bodyMaterial.color.set(definition.color);
    this.hp = definition.maxHp;
    this.speed = definition.speed;
    this.damage = definition.damage;
    this.radius = definition.radius;
    this.xpValue = definition.xpValue;
    this.group.position.copy(position);
    this.group.position.y = 0.05;
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

    // Chase player on the XZ plane.
    this.target.copy(playerPos);
    this.target.y = 0;
    this.dir.copy(this.target).sub(this.group.position);
    this.dir.y = 0;
    const dist = this.dir.length();
    if (dist > 0.01) {
      this.dir.divideScalar(dist);
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
    this.attackCooldown = 0.8;
    return true;
  }

  despawn(): void {
    this.active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.bodyGeometry.dispose();
    this.bodyMaterial.dispose();
  }
}
