import * as THREE from 'three';

/** Lightweight spatial helpers. Game.ts uses direct circle tests for now;
 *  this module stays as the home for future grid/spatial-hash queries. */
export class CollisionSystem {
  private readonly delta = new THREE.Vector3();

  /** Circle-vs-circle distance test on the XZ plane (y ignored). */
  circleHit(
    a: THREE.Vector3,
    aRadius: number,
    b: THREE.Vector3,
    bRadius: number,
  ): boolean {
    this.delta.copy(a).sub(b);
    this.delta.y = 0;
    const radius = aRadius + bRadius;
    return this.delta.lengthSq() <= radius * radius;
  }
}
