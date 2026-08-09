import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { UPGRADES } from '../data/upgrades';
import { Enemy, type EnemyDefinition } from '../entities/Enemy';
import { Player, type ArenaBounds } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import type { UpgradeDefinition } from '../game/Stats';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';
import { createSeededRandom } from '../utils/random';

const ARENA: ArenaBounds = { halfWidth: 16, halfDepth: 10 };

const ENEMY_DEFS: Record<string, EnemyDefinition> = {
  cinder: { id: 'cinder', name: 'Cinder', maxHp: 14, speed: 2.6, damage: 8, radius: 0.45, color: '#d94f35', xpValue: 1 },
  ember: { id: 'ember', name: 'Ember', maxHp: 8, speed: 4.2, damage: 6, radius: 0.38, color: '#f5a13b', xpValue: 1 },
};

const MAX_ENEMIES = 80;
const MAX_PROJECTILES = 64;

type GameState = 'playing' | 'levelup' | 'gameover' | 'victory';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
  private readonly input: InputController;
  private readonly player = new Player();
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly audio = new AudioSystem();
  private readonly hud = new Hud();
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly loop = new Loop((delta, elapsed) => this.update(delta, elapsed), () => this.render());

  private readonly tuning: DebugTuning = {
    speed: 6.5,
    acceleration: 14,
    cameraLag: 0.18,
    exposure: 1.05,
    maxDpr: 2,
  };

  private readonly debugTools: DebugTools;
  private frame = 0;
  private elapsed = 0;
  private kills = 0;
  private state: GameState = 'playing';
  private rng = createSeededRandom(1);
  private pausedForScreenshot = false;
  private reducedMotion = false;
  private fireCooldown = 0;
  private spawnCooldown = 0.8;
  private waveNumber = 1;

  private readonly spawnPos = new THREE.Vector3();
  private readonly dirVec = new THREE.Vector3();
  private readonly targetVec = new THREE.Vector3();
  private readonly levelUpChoices: UpgradeDefinition[] = [];
  private pendingLevelUps = 0;
  private readonly fanDir = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;

    const stick = this.getElement('#touch-stick');
    const knob = this.getElement('#touch-knob');
    const dashButton = this.getElement('#dash-button');
    this.input = new InputController(stick, knob, dashButton);

    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
      resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    });

    // Pre-create pooled enemies and projectiles (no allocation during combat).
    for (let i = 0; i < MAX_ENEMIES; i += 1) {
      const enemy = new Enemy();
      this.enemies.push(enemy);
      this.scene.add(enemy.group);
    }
    for (let i = 0; i < MAX_PROJECTILES; i += 1) {
      const projectile = new Projectile();
      this.projectiles.push(projectile);
      this.scene.add(projectile.mesh);
    }

    this.createScene();
    this.hud.setWave(1);
    this.cameraRig.snapTo(this.player.group.position);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.installTestHooks();
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
    this.debugTools.dispose();
    for (const enemy of this.enemies) enemy.dispose();
    for (const projectile of this.projectiles) projectile.dispose();
    this.player.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    if (this.pausedForScreenshot) {
      this.publishDiagnostics();
      return;
    }
    if (this.state === 'playing') this.elapsed += delta;

    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    const animElapsed = this.reducedMotion ? 0 : elapsed;

    if (this.state === 'playing') {
      this.player.update(delta, animElapsed, this.input, this.tuning, ARENA);
      this.updateWaves(delta);
      this.updateEnemies(delta);
      this.updateAutoFire(delta);
      this.updateProjectiles(delta);
      this.handleCollisions();
      if (this.pendingLevelUps > 0) this.openLevelUp();
    } else if (this.state === 'levelup') {
      // Game paused for the upgrade pick; 1/2/3 or click chooses.
      const pick = this.input.consumeDigitPick();
      if (pick !== null) this.chooseUpgrade(pick);
    } else if (this.state === 'gameover' || this.state === 'victory') {
      if (this.input.consumeRetry()) this.resetRun();
    }

    this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag);
    this.hud.update(
      this.player.hp,
      this.player.maxHp,
      this.player.level,
      this.player.xp,
      this.player.xpToNext,
      this.waveNumber,
      this.kills,
      this.elapsed,
      this.state,
    );
    this.publishDiagnostics();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private updateWaves(delta: number): void {
    const newWave = Math.floor(this.elapsed / 20) + 1;
    if (newWave !== this.waveNumber) {
      this.waveNumber = newWave;
      this.hud.setWave(this.waveNumber);
    }

    this.spawnCooldown -= delta;
    if (this.spawnCooldown <= 0) {
      const activeCount = this.enemies.filter((e) => e.active).length;
      const waveCap = Math.min(MAX_ENEMIES, 12 + this.waveNumber * 4);
      if (activeCount < waveCap) this.spawnEnemy();
      // Waves get denser over time.
      this.spawnCooldown = Math.max(0.28, 1.1 - this.waveNumber * 0.045);
    }
  }

  private spawnEnemy(): void {
    const enemy = this.enemies.find((e) => !e.active);
    if (!enemy) return;

    // Spawn at a random arena edge, away from the player.
    const edge = Math.floor(this.rng() * 4);
    const margin = 1.2;
    if (edge === 0) this.spawnPos.set((this.rng() * 2 - 1) * ARENA.halfWidth, 0.05, -ARENA.halfDepth - margin);
    else if (edge === 1) this.spawnPos.set((this.rng() * 2 - 1) * ARENA.halfWidth, 0.05, ARENA.halfDepth + margin);
    else if (edge === 2) this.spawnPos.set(-ARENA.halfWidth - margin, 0.05, (this.rng() * 2 - 1) * ARENA.halfDepth);
    else this.spawnPos.set(ARENA.halfWidth + margin, 0.05, (this.rng() * 2 - 1) * ARENA.halfDepth);

    const def = this.rng() < 0.35 ? ENEMY_DEFS.ember : ENEMY_DEFS.cinder;
    enemy.spawn(def, this.spawnPos);
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.update(delta, this.player.group.position);
      // Contact damage with a per-enemy cooldown.
      this.targetVec.copy(enemy.group.position).sub(this.player.group.position);
      this.targetVec.y = 0;
      const rr = enemy.radius + this.player.radius;
      if (this.targetVec.lengthSq() <= rr * rr && enemy.tryAttack()) {
        this.player.takeDamage(enemy.damage);
        this.audio.hit();
        this.cameraRig.addImpulse(0.22);
      }
    }
  }

  private updateAutoFire(delta: number): void {
    this.fireCooldown -= delta;
    if (this.fireCooldown > 0 || !this.player.alive) return;

    const origin = this.player.aimOrigin;
    // Auto-aim at the nearest active enemy.
    let nearest: Enemy | null = null;
    let nearestSq = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      this.dirVec.copy(enemy.group.position).sub(origin);
      this.dirVec.y = 0;
      const dSq = this.dirVec.lengthSq();
      if (dSq < nearestSq) {
        nearestSq = dSq;
        nearest = enemy;
      }
    }

    if (nearest) {
      const count = Math.max(1, Math.round(this.player.stats.get('projectileCount')));
      const cooldown = 0.34 / Math.max(0.1, this.player.stats.get('attackSpeed'));
      const damage = this.player.stats.get('damage');
      const fired = this.fireFan(origin, nearest.group.position, count, damage);
      if (fired) {
        this.audio.shoot();
        this.fireCooldown = cooldown;
      }
    }
  }

  /** Fire `count` projectiles in a narrow fan toward the target. */
  private fireFan(origin: THREE.Vector3, target: THREE.Vector3, count: number, damage: number): boolean {
    this.dirVec.copy(target).sub(origin);
    this.dirVec.y = 0;
    if (this.dirVec.lengthSq() < 0.0001) return false;
    this.dirVec.normalize();

    const spread = count > 1 ? 0.16 : 0;
    const baseAngle = Math.atan2(this.dirVec.x, this.dirVec.z);
    let firedAny = false;
    for (let i = 0; i < count; i += 1) {
      const projectile = this.projectiles.find((p) => !p.active);
      if (!projectile) break;
      const angle = baseAngle + (i - (count - 1) / 2) * spread;
      this.fanDir.set(Math.sin(angle), 0, Math.cos(angle));
      projectile.spawn(origin, this.fanDir, damage, 16);
      firedAny = true;
    }
    return firedAny;
  }

  private updateProjectiles(delta: number): void {
    for (const projectile of this.projectiles) {
      if (projectile.active) projectile.update(delta);
    }
  }

  private handleCollisions(): void {
    // Projectiles vs enemies.
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        this.dirVec.copy(projectile.mesh.position).sub(enemy.group.position);
        this.dirVec.y = 0;
        const rr = projectile.radius + enemy.radius;
        if (this.dirVec.lengthSq() <= rr * rr) {
          enemy.takeDamage(projectile.damage);
          projectile.despawn();
          if (!enemy.active) {
            this.kills += 1;
            this.audio.kill();
            this.cameraRig.addImpulse(0.1);
            this.pendingLevelUps += this.player.addXp(enemy.xpValue);
          }
          break;
        }
      }
    }

    if (!this.player.alive && this.state === 'playing') {
      this.state = 'gameover';
      this.audio.gameOver();
    }
  }

  /** Weighted, distinct 3-choice pool for the level-up screen. */
  private rollUpgradeChoices(): UpgradeDefinition[] {
    const pool = UPGRADES.slice();
    const choices: UpgradeDefinition[] = [];
    while (choices.length < 3 && pool.length > 0) {
      const totalWeight = pool.reduce((sum, u) => sum + u.weight, 0);
      let roll = this.rng() * totalWeight;
      let index = 0;
      for (let i = 0; i < pool.length; i += 1) {
        roll -= pool[i].weight;
        if (roll <= 0) {
          index = i;
          break;
        }
      }
      choices.push(pool[index]);
      pool.splice(index, 1);
    }
    return choices;
  }

  private openLevelUp(): void {
    this.state = 'levelup';
    this.levelUpChoices.length = 0;
    this.levelUpChoices.push(...this.rollUpgradeChoices());
    this.hud.showLevelUp(this.levelUpChoices, (index) => this.chooseUpgrade(index));
    this.publishDiagnostics();
  }

  private chooseUpgrade(index: number): void {
    const upgrade = this.levelUpChoices[index];
    if (!upgrade) return;
    this.player.applyUpgrade(upgrade);
    this.audio.levelUp();
    this.hud.hideLevelUp();
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    // Multiple level-ups from one big XP drop: reopen the screen.
    if (this.pendingLevelUps > 0) {
      this.openLevelUp();
    } else {
      this.state = 'playing';
    }
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#16130f');
    this.scene.fog = new THREE.Fog('#16130f', 30, 55);

    const hemisphere = new THREE.HemisphereLight('#f6e3c8', '#3a2a1a', 1.6);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight('#ffd9a0', 2.4);
    sun.position.set(-6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    this.scene.add(sun);

    this.scene.add(this.createArena());
    this.scene.add(this.player.group);
  }

  private createArena(): THREE.Group {
    const arena = new THREE.Group();

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfWidth * 2, ARENA.halfDepth * 2, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#2c211a', roughness: 0.85, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arena.add(floor);

    // Scattered low-poly rocks (shared geometry/material).
    const rockGeometry = new THREE.IcosahedronGeometry(0.5, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: '#4a3628', roughness: 0.9 });
    const rockCount = 26;
    for (let i = 0; i < rockCount; i += 1) {
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      const angle = this.rng() * Math.PI * 2;
      const radius = 4 + this.rng() * (Math.min(ARENA.halfWidth, ARENA.halfDepth) - 5);
      rock.position.set(Math.cos(angle) * radius, 0.25, Math.sin(angle) * radius);
      const scale = 0.5 + this.rng() * 1.2;
      rock.scale.set(scale, scale * 0.8, scale);
      rock.rotation.y = this.rng() * Math.PI;
      rock.castShadow = true;
      rock.receiveShadow = true;
      arena.add(rock);
    }

    // Boundary rails.
    const railMaterial = new THREE.MeshStandardMaterial({ color: '#d94f35', roughness: 0.52 });
    const longRailGeometry = new THREE.BoxGeometry(ARENA.halfWidth * 2 + 1, 0.55, 0.42);
    const shortRailGeometry = new THREE.BoxGeometry(0.42, 0.55, ARENA.halfDepth * 2 + 1);
    const rails = [
      new THREE.Mesh(longRailGeometry, railMaterial),
      new THREE.Mesh(longRailGeometry, railMaterial),
      new THREE.Mesh(shortRailGeometry, railMaterial),
      new THREE.Mesh(shortRailGeometry, railMaterial),
    ];
    rails[0].position.set(0, 0.28, -ARENA.halfDepth - 0.24);
    rails[1].position.set(0, 0.28, ARENA.halfDepth + 0.24);
    rails[2].position.set(-ARENA.halfWidth - 0.24, 0.28, 0);
    rails[3].position.set(ARENA.halfWidth + 0.24, 0.28, 0);
    for (const rail of rails) {
      rail.castShadow = true;
      rail.receiveShadow = true;
      arena.add(rail);
    }

    return arena;
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.rng = createSeededRandom(value);
      },
      setState: (name: string) => {
        if (name === 'active-play') this.resetRun();
        else if (name === 'gameover') this.state = 'gameover';
        else if (name === 'victory') this.state = 'victory';
        else console.warn(`Unknown test state: ${name}`);
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
      },
      hideDebugUi: (hidden: boolean) => {
        this.debugTools.setHidden(hidden);
      },
    };
  }

  private resetRun(): void {
    this.elapsed = 0;
    this.kills = 0;
    this.waveNumber = 1;
    this.state = 'playing';
    this.fireCooldown = 0;
    this.spawnCooldown = 0.8;
    this.pendingLevelUps = 0;
    this.player.reset();
    for (const enemy of this.enemies) enemy.despawn();
    for (const projectile of this.projectiles) projectile.despawn();
    this.hud.hideLevelUp();
    this.cameraRig.snapTo(this.player.group.position);
    this.hud.setWave(1);
    this.hud.update(
      this.player.hp,
      this.player.maxHp,
      this.player.level,
      this.player.xp,
      this.player.xpToNext,
      this.waveNumber,
      this.kills,
      this.elapsed,
      this.state,
    );
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      state: this.state,
      wave: this.waveNumber,
      kills: this.kills,
      hp: this.player.hp,
      level: this.player.level,
      xp: this.player.xp,
      player: {
        position: {
          x: this.player.group.position.x,
          y: this.player.group.position.y,
          z: this.player.group.position.z,
        },
        speed: this.player.velocity.length(),
      },
      entities: {
        activeEnemies: this.enemies.filter((e) => e.active).length,
        activeProjectiles: this.projectiles.filter((p) => p.active).length,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, this.tuning.maxDpr),
      },
    };
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }
}
