import * as THREE from 'three';

/** Near-orthographic 45-degree chase camera with smooth follow + subtle shake. */
export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private shakeTime = 0;
  private shakeAmount = 0;

  constructor(
    private readonly camera: THREE.OrthographicCamera,
    private readonly offset = new THREE.Vector3(0, 14, 14),
  ) {}

  snapTo(target: THREE.Vector3): void {
    this.desiredPosition.copy(target).add(this.offset);
    this.camera.position.copy(this.desiredPosition);
    this.lookTarget.copy(target);
    this.camera.lookAt(this.lookTarget);
  }

  update(delta: number, target: THREE.Vector3, lag: number): void {
    this.desiredPosition.copy(target).add(this.offset);
    const factor = 1 - Math.exp(-delta / Math.max(0.001, lag));
    this.camera.position.lerp(this.desiredPosition, factor);
    this.lookTarget.copy(target);
    this.camera.lookAt(this.lookTarget);

    // Decaying screen shake; addImpulse() feeds it.
    this.shakeTime = Math.max(0, this.shakeTime - delta);
    const intensity = this.shakeAmount * (this.shakeTime / Math.max(0.001, this.shakeTime + delta));
    if (this.shakeTime > 0) {
      this.camera.position.x += (Math.random() - 0.5) * intensity;
      this.camera.position.y += (Math.random() - 0.5) * intensity * 0.5;
    } else {
      this.shakeAmount = 0;
    }
  }

  addImpulse(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeTime = Math.max(this.shakeTime, 0.35);
  }
}
