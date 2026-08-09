import * as THREE from 'three';

/** Pooled projectile. Flies straight, damages the first enemy it hits, then despawns. */
export class Projectile {
  readonly mesh: THREE.Mesh;
  active = false;
  damage = 10;
  speed = 14;
  radius = 0.2;

  private readonly geometry = new THREE.SphereGeometry(0.16, 6, 6);
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#ffd27f',
    emissive: '#ff9d3f',
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  private readonly velocity = new THREE.Vector3();
  private life = 0;

  constructor() {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.visible = false;
  }

  spawn(origin: THREE.Vector3, dir: THREE.Vector3, damage: number, speed: number): void {
    this.mesh.position.copy(origin);
    this.velocity.copy(dir).normalize().multiplyScalar(speed);
    this.damage = damage;
    this.speed = speed;
    this.mesh.visible = true;
    this.active = true;
    this.life = 3;
  }

  update(delta: number): boolean {
    if (!this.active) return false;
    this.mesh.position.addScaledVector(this.velocity, delta);
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
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
