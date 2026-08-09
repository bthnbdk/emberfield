import * as THREE from 'three';

type Particle = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  active: boolean;
};

/** Pooled additive particle bursts for kills, hits, level-ups and pickups.
 *  One shared Points cloud; particles are recycled, so no per-burst allocations
 *  or GPU buffer churn during combat. */
export class ParticleSystem {
  readonly points: THREE.Points;

  private readonly particles: Particle[] = [];
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private cursor = 0;
  private readonly scratch = new THREE.Color();

  constructor(capacity = 600) {
    this.particles = Array.from({ length: capacity }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      size: 1,
      color: new THREE.Color('#ffb35c'),
      active: false,
    }));

    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('color', this.colorAttr);
    this.geometry.setDrawRange(0, capacity);

    this.material = new THREE.PointsMaterial({
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Spawn a short-lived burst of `count` particles at `origin`. */
  burst(origin: THREE.Vector3, count: number, color: string, speed = 4, life = 0.6, size = 0.24): void {
    this.scratch.set(color);
    for (let i = 0; i < count; i += 1) {
      const p = this.particles[this.cursor % this.particles.length];
      this.cursor += 1;
      p.active = true;
      p.position.copy(origin);
      p.velocity.set(
        (Math.random() - 0.5) * speed * 2,
        Math.random() * speed * 1.4 + 0.4,
        (Math.random() - 0.5) * speed * 2,
      );
      p.life = life * (0.5 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.size = size * (0.7 + Math.random() * 0.8);
      p.color.copy(this.scratch);
    }
    this.points.visible = true;
  }

  /** Ring-shaped shockwave burst (nova / boss telegraphs). */
  ring(origin: THREE.Vector3, color: string, count = 26, speed = 8, life = 0.5): void {
    this.scratch.set(color);
    for (let i = 0; i < count; i += 1) {
      const p = this.particles[this.cursor % this.particles.length];
      this.cursor += 1;
      const angle = (i / count) * Math.PI * 2;
      p.active = true;
      p.position.copy(origin);
      p.velocity.set(Math.cos(angle) * speed, 0.6, Math.sin(angle) * speed);
      p.life = life * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = 0.2;
      p.color.copy(this.scratch);
    }
    this.points.visible = true;
  }

  update(delta: number): void {
    let anyActive = false;
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      anyActive = true;
      p.position.addScaledVector(p.velocity, delta);
      p.velocity.y -= 2.2 * delta; // gravity so sparks arc down
      const t = p.life / p.maxLife;
      this.positionAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);
      this.colorAttr.setXYZ(i, p.color.r * t, p.color.g * t, p.color.b * t);
    }
    if (!anyActive) {
      this.points.visible = false;
      return;
    }
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
