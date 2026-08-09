import * as THREE from 'three';

/** Pooled gold coin pickup. Spawns at a kill, magnetizes toward the player
 *  when close, and despawns on pickup. */
export class Pickup {
  readonly mesh: THREE.Mesh;
  active = false;
  value = 1;

  private readonly geometry = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10);
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#f5ba49',
    emissive: '#c77d1e',
    emissiveIntensity: 0.7,
    metalness: 0.85,
    roughness: 0.25,
  });
  private readonly glow: THREE.Sprite;
  private readonly spinAxis = new THREE.Vector3(0, 1, 0);
  private age = 0;
  private life = 0;

  constructor() {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.visible = false;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(245, 186, 73, 0.85)');
      gradient.addColorStop(0.6, 'rgba(245, 186, 73, 0.25)');
      gradient.addColorStop(1, 'rgba(245, 186, 73, 0)');
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
    this.glow.scale.set(0.8, 0.8, 1);
    this.glow.visible = false;
  }

  get sprite(): THREE.Sprite {
    return this.glow;
  }

  spawn(position: THREE.Vector3, value: number): void {
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.35;
    this.value = value;
    this.age = 0;
    this.life = 22;
    this.mesh.visible = true;
    this.glow.visible = true;
    this.glow.position.copy(this.mesh.position);
    this.active = true;
  }

  /** Returns true while alive; magnet pulls it toward the player. */
  update(delta: number, playerPos: THREE.Vector3, magnetRadius: number): boolean {
    if (!this.active) return false;
    this.age += delta;
    this.life -= delta;
    if (this.life <= 0) {
      this.despawn();
      return false;
    }

    // Bob + spin.
    this.mesh.position.y = 0.35 + Math.sin(this.age * 4) * 0.06;
    this.mesh.rotateOnAxis(this.spinAxis, delta * 3.2);
    this.glow.position.copy(this.mesh.position);

    // Magnet pull.
    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < magnetRadius * magnetRadius && distSq > 0.001) {
      const dist = Math.sqrt(distSq);
      const pull = (1 - dist / magnetRadius) * 9 + 3;
      this.mesh.position.x += (dx / dist) * pull * delta;
      this.mesh.position.z += (dz / dist) * pull * delta;
      this.glow.position.copy(this.mesh.position);
    }

    // Pulsing glow fade near expiry.
    const fade = Math.min(1, this.life / 3);
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(this.age * 6) * 0.2;
    (this.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = fade * 0.7;
    return true;
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
    this.glow.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.glow.material.dispose();
    this.glow.material.map?.dispose();
  }
}
