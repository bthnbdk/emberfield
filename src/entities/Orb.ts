import * as THREE from 'three';

/** Pooled orbiting ember. Circles the player; damages enemies on contact with
 *  a short per-enemy cooldown. Visual = glowing sphere + additive halo. */
export class Orb {
  readonly group = new THREE.Group();
  active = false;
  damage = 10;
  radius = 0.42;
  /** Contact cooldown per enemy (ms via timestamps keyed by enemy id). */
  private readonly hitCooldowns = new Map<EnemyLike, number>();

  private readonly geometry = new THREE.SphereGeometry(0.26, 10, 10);
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#7fe0c8',
    emissive: '#2f8a78',
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.2,
  });
  private readonly glow: THREE.Sprite;
  private angle = 0;
  private radiusOrbit = 2.3;
  private height = 0.75;

  constructor() {
    const orbMesh = new THREE.Mesh(this.geometry, this.material);
    orbMesh.castShadow = true;
    this.group.add(orbMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(127, 224, 200, 0.9)');
      gradient.addColorStop(0.5, 'rgba(47, 138, 120, 0.35)');
      gradient.addColorStop(1, 'rgba(47, 138, 120, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glow.scale.set(1.1, 1.1, 1);
    this.group.add(this.glow);
    this.group.visible = false;
  }

  get sprite(): THREE.Sprite {
    return this.glow;
  }

  /** Spawn an orb at an initial orbit angle; `slot` offsets rings evenly. */
  spawn(angle: number, damage: number, orbitRadius: number, slot: number): void {
    this.angle = angle + (slot / 4) * Math.PI * 2;
    this.damage = damage;
    this.radiusOrbit = orbitRadius;
    this.group.visible = true;
    this.active = true;
    this.hitCooldowns.clear();
  }

  /** Update orbit around the player center. */
  update(delta: number, center: THREE.Vector3): void {
    if (!this.active) return;
    this.angle += delta * 2.6;
    const wobble = Math.sin(this.angle * 1.7) * 0.18;
    this.group.position.set(
      center.x + Math.cos(this.angle) * this.radiusOrbit,
      this.height + wobble,
      center.z + Math.sin(this.angle) * this.radiusOrbit,
    );
    this.group.rotation.y = this.angle;
  }

  /** Returns true when this enemy is in contact and NOT on cooldown. */
  canHit(enemy: EnemyLike, now: number): boolean {
    const last = this.hitCooldowns.get(enemy) ?? -Infinity;
    return now - last >= 0.45;
  }

  registerHit(enemy: EnemyLike, now: number): void {
    this.hitCooldowns.set(enemy, now);
  }

  despawn(): void {
    this.active = false;
    this.group.visible = false;
    this.hitCooldowns.clear();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.glow.material.dispose();
    this.glow.material.map?.dispose();
  }
}

/** Minimal structural type so Orb does not import Enemy (avoids cycles). */
export interface EnemyLike {
  active: boolean;
  radius: number;
  group: { position: THREE.Vector3 };
}
