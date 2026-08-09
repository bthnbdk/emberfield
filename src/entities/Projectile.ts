import * as THREE from 'three';

/** Pooled projectile. Flies straight, damages enemies it hits, then despawns.
 *  Supports piercing (hits N enemies before dying) and crits (double damage
 *  burst with a brighter look). */
export class Projectile {
  readonly mesh: THREE.Mesh;
  active = false;
  damage = 10;
  speed = 14;
  radius = 0.2;
  /** Remaining enemies this projectile can pierce through. */
  pierce = 0;
  /** Applied once at spawn: true = crit look + damage already doubled. */
  isCrit = false;

  private readonly geometry = new THREE.SphereGeometry(0.16, 6, 6);
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#ffd27f',
    emissive: '#ff9d3f',
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  private readonly trail: THREE.Sprite;
  private readonly velocity = new THREE.Vector3();
  private life = 0;

  constructor() {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.visible = false;

    // Soft glow trail so shots read as fire at speed.
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 210, 127, 0.9)');
      gradient.addColorStop(0.5, 'rgba(255, 157, 63, 0.35)');
      gradient.addColorStop(1, 'rgba(255, 157, 63, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    this.trail = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.trail.scale.set(0.9, 0.9, 1);
    this.trail.visible = false;
  }

  get sprite(): THREE.Sprite {
    return this.trail;
  }

  spawn(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    damage: number,
    speed: number,
    color: string,
    pierce = 0,
    isCrit = false,
  ): void {
    this.mesh.position.copy(origin);
    this.velocity.copy(dir).normalize().multiplyScalar(speed);
    this.damage = damage;
    this.speed = speed;
    this.pierce = pierce;
    this.isCrit = isCrit;
    this.mesh.visible = true;
    this.trail.visible = true;
    this.trail.position.copy(origin);
    this.material.color.set(color);
    this.material.emissive.set(color);
    this.material.emissiveIntensity = isCrit ? 2.2 : 1.4;
    this.mesh.scale.setScalar(isCrit ? 1.35 : 1);
    this.active = true;
    this.life = 3;
  }

  /** Returns true when the projectile should be considered a hit and keep flying
   *  (pierce remaining), false when it must despawn. */
  onHit(): boolean {
    if (this.pierce > 0) {
      this.pierce -= 1;
      return true;
    }
    this.despawn();
    return false;
  }

  update(delta: number): boolean {
    if (!this.active) return false;
    this.mesh.position.addScaledVector(this.velocity, delta);
    this.trail.position.copy(this.mesh.position);
    this.life -= delta;
    if (this.life <= 0) {
      this.despawn();
      return false;
    }
    return true;
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
    this.trail.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.trail.material.dispose();
    this.trail.material.map?.dispose();
  }
}
