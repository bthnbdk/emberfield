import * as THREE from 'three';

/** Pooled enemy projectile (spitter shots). Flies straight, damages the player
 *  on contact, despawns on timeout or arena exit. */
export class EnemyProjectile {
  readonly mesh: THREE.Mesh;
  active = false;
  damage = 8;
  speed = 7;
  radius = 0.26;

  private readonly geometry = new THREE.SphereGeometry(0.2, 8, 8);
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#c77dff',
    emissive: '#7a2fd8',
    emissiveIntensity: 1.1,
    roughness: 0.4,
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
    this.life = 4;
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
