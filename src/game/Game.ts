import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { UPGRADES } from '../data/upgrades';
import { SHOP_WEAPONS, STARTING_WEAPON, WEAPONS, type WeaponDefinition } from '../data/weapons';
import { Enemy, type EnemyDefinition } from '../entities/Enemy';
import { Pickup } from '../entities/Pickup';
import { Player, type ArenaBounds } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import type { UpgradeDefinition } from '../game/Stats';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';
import { ParticleSystem } from '../systems/ParticleSystem';
import { createSeededRandom } from '../utils/random';

const ARENA: ArenaBounds = { halfWidth: 16, halfDepth: 10 };

const ENEMY_DEFS: Record<string, EnemyDefinition> = {
  cinder: { id: 'cinder', name: 'Cinder', maxHp: 14, speed: 2.6, damage: 8, radius: 0.45, color: '#d94f35', xpValue: 1, goldValue: 1, scale: 1 },
  ember: { id: 'ember', name: 'Ember', maxHp: 8, speed: 4.2, damage: 6, radius: 0.38, color: '#f5a13b', xpValue: 1, goldValue: 1, scale: 0.85 },
  wisp: { id: 'wisp', name: 'Wisp', maxHp: 5, speed: 5.6, damage: 5, radius: 0.3, color: '#7fe0c8', xpValue: 2, goldValue: 2, scale: 0.7 },
  brute: { id: 'brute', name: 'Brute', maxHp: 60, speed: 1.55, damage: 16, radius: 0.85, color: '#8a3a2b', xpValue: 4, goldValue: 5, scale: 1.9 },
  infernal: { id: 'infernal', name: 'Infernal Core', maxHp: 420, speed: 1.05, damage: 22, radius: 1.35, color: '#5a1220', xpValue: 25, goldValue: 30, scale: 3.1, boss: true },
};

const MAX_ENEMIES = 80;
const MAX_PROJECTILES = 64;
const MAX_PICKUPS = 60;
const BOSS_INTERVAL = 45;

type GameState = 'playing' | 'levelup' | 'shop' | 'gameover' | 'victory';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
  private readonly input: InputController;
  private readonly player = new Player();
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly audio = new AudioSystem();
  private readonly hud = new Hud();
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly particles = new ParticleSystem();
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
  private bossSpawnedAt = 0;
  private bossActive = false;
  private shopOffer: WeaponDefinition[] = [];
  private ownedWeapons: string[] = [STARTING_WEAPON.id];
  private activeWeaponIndex = 0;
  private shopUpgradeCost = 25;
  private shopUpgradeCount = 0;

  private readonly spawnPos = new THREE.Vector3();
  private readonly dirVec = new THREE.Vector3();
  private readonly targetVec = new THREE.Vector3();
  private readonly levelUpChoices: UpgradeDefinition[] = [];
  private pendingLevelUps = 0;
  private readonly fanDir = new THREE.Vector3();
  private readonly pickupOrigin = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;

    const stick = this.getElement('#touch-stick');
    const knob = this.getElement('#touch-knob');
    const dashButton = this.getElement('#dash-button');
    const shopButton = this.getElement('#shop-button');
    this.input = new InputController(stick, knob, dashButton, shopButton);

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
      this.scene.add(projectile.sprite);
    }
    for (let i = 0; i < MAX_PICKUPS; i += 1) {
      const pickup = new Pickup();
      this.pickups.push(pickup);
      this.scene.add(pickup.mesh);
      this.scene.add(pickup.sprite);
    }

    this.createScene();
    this.hud.setWave(1);
    this.hud.setGold(0);
    this.hud.setWeapon(this.activeWeapon.name);
    this.cameraRig.snapTo(this.player.group.position);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.installTestHooks();
    this.publishDiagnostics();
  }

  get activeWeapon(): WeaponDefinition {
    return WEAPONS[this.ownedWeapons[this.activeWeaponIndex]] ?? STARTING_WEAPON;
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
    for (const pickup of this.pickups) pickup.dispose();
    this.player.dispose();
    this.particles.dispose();
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
    if (this.state === 'playing' || this.state === 'shop') this.elapsed += delta;

    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    const animElapsed = this.reducedMotion ? 0 : elapsed;

    if (this.state === 'playing') {
      this.player.update(delta, animElapsed, this.input, this.tuning, ARENA);
      this.updateWaves(delta);
      this.updateEnemies(delta);
      this.updateAutoFire(delta);
      this.updateProjectiles(delta);
      this.handleCollisions();
      this.updatePickups(delta);
      if (this.pendingLevelUps > 0) this.openLevelUp();
      if (this.input.consumeWeaponSwitch() && this.ownedWeapons.length > 1) {
        this.cycleWeapon();
      }
      if (this.input.consumeShopOpen()) this.openShop();
    } else if (this.state === 'levelup') {
      const pick = this.input.consumeDigitPick();
      if (pick !== null) this.chooseUpgrade(pick);
    } else if (this.state === 'shop') {
      // Shop is open: still animate pickups/particles behind the panel.
      this.updatePickups(delta);
      if (this.input.consumeWeaponSwitch()) this.closeShop();
      if (this.input.consumeShopOpen()) this.closeShop();
      if (this.input.consumeRetry()) this.resetRun();
    } else if (this.state === 'gameover' || this.state === 'victory') {
      if (this.input.consumeRetry()) this.resetRun();
    }

    this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag);
    this.particles.update(delta);
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
      if (this.waveNumber > 1 && this.waveNumber % 3 === 0) {
        // Periodic shop restock window: open once per restock wave is player-initiated.
        this.shopUpgradeCost = 25 + this.waveNumber * 3;
      }
    }

    // Boss spawn cadence.
    if (!this.bossActive && this.elapsed - this.bossSpawnedAt >= BOSS_INTERVAL) {
      this.spawnBoss();
      this.bossSpawnedAt = this.elapsed;
    }

    this.spawnCooldown -= delta;
    if (this.spawnCooldown <= 0) {
      const activeCount = this.enemies.filter((e) => e.active).length;
      const waveCap = Math.min(MAX_ENEMIES, 12 + this.waveNumber * 4);
      if (activeCount < waveCap) this.spawnEnemy();
      this.spawnCooldown = Math.max(0.28, 1.1 - this.waveNumber * 0.045);
    }
  }

  private pickEnemyDef(): EnemyDefinition {
    const roll = this.rng();
    if (this.waveNumber >= 3 && roll < 0.16) return ENEMY_DEFS.wisp;
    if (this.waveNumber >= 4 && roll < 0.3) return ENEMY_DEFS.brute;
    if (roll < 0.35) return ENEMY_DEFS.ember;
    return ENEMY_DEFS.cinder;
  }

  private spawnEnemy(): void {
    const enemy = this.enemies.find((e) => !e.active);
    if (!enemy) return;

    const edge = Math.floor(this.rng() * 4);
    const margin = 1.2;
    if (edge === 0) this.spawnPos.set((this.rng() * 2 - 1) * ARENA.halfWidth, 0.05, -ARENA.halfDepth - margin);
    else if (edge === 1) this.spawnPos.set((this.rng() * 2 - 1) * ARENA.halfWidth, 0.05, ARENA.halfDepth + margin);
    else if (edge === 2) this.spawnPos.set(-ARENA.halfWidth - margin, 0.05, (this.rng() * 2 - 1) * ARENA.halfDepth);
    else this.spawnPos.set(ARENA.halfWidth + margin, 0.05, (this.rng() * 2 - 1) * ARENA.halfDepth);

    enemy.spawn(this.pickEnemyDef(), this.spawnPos);
  }

  private spawnBoss(): void {
    const boss = this.enemies.find((e) => !e.active);
    if (!boss) return;
    this.spawnPos.set(0, 0.05, -ARENA.halfDepth - 2);
    boss.spawn(ENEMY_DEFS.infernal, this.spawnPos);
    this.bossActive = true;
    this.hud.setBossVisible(true, ENEMY_DEFS.infernal.name);
    this.audio.boss();
    // Telegraph ring so the player sees where it lands.
    this.particles.ring(new THREE.Vector3(0, 0.4, -ARENA.halfDepth - 2), '#ff6a4d', 30, 10, 0.7);
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.update(delta, this.player.group.position);
      if (enemy.boss) this.hud.setBossHp(enemy.hp / ENEMY_DEFS.infernal.maxHp);
      this.targetVec.copy(enemy.group.position).sub(this.player.group.position);
      this.targetVec.y = 0;
      const rr = enemy.radius + this.player.radius;
      if (this.targetVec.lengthSq() <= rr * rr && enemy.tryAttack()) {
        this.player.takeDamage(enemy.damage);
        this.audio.hit();
        this.cameraRig.addImpulse(0.22);
        this.particles.burst(this.player.group.position, 6, '#ff6a4d', 3, 0.4);
      }
    }
  }

  private updateAutoFire(delta: number): void {
    this.fireCooldown -= delta;
    if (this.fireCooldown > 0 || !this.player.alive) return;

    const origin = this.player.aimOrigin;
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
      const weapon = this.activeWeapon;
      const statCount = Math.max(1, Math.round(this.player.stats.get('projectileCount')));
      const count = weapon.kind === 'nova' ? weapon.count : Math.max(1, weapon.count + statCount - 1);
      const cooldown = weapon.cooldown / Math.max(0.1, this.player.stats.get('attackSpeed'));
      const weaponDamage = weapon.damage * this.player.stats.get(weapon.scaleStat);
      const critMult = this.player.rollCrit();
      const damage = weaponDamage * critMult;
      const pierce = weapon.pierce + Math.round(this.player.stats.get('pierce'));
      const fired = this.firePattern(origin, nearest.group.position, weapon, count, damage, pierce, critMult > 1);
      if (fired) {
        this.audio.shoot();
        this.fireCooldown = cooldown;
      }
    }
  }

  /** Fire `count` projectiles according to the weapon archetype. */
  private firePattern(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    weapon: WeaponDefinition,
    count: number,
    damage: number,
    pierce: number,
    isCrit: boolean,
  ): boolean {
    this.dirVec.copy(target).sub(origin);
    this.dirVec.y = 0;
    if (this.dirVec.lengthSq() < 0.0001) return false;
    this.dirVec.normalize();

    if (weapon.kind === 'nova') {
      // Full ring around the player.
      let firedAny = false;
      for (let i = 0; i < count; i += 1) {
        const projectile = this.projectiles.find((p) => !p.active);
        if (!projectile) break;
        const angle = (i / count) * Math.PI * 2;
        this.fanDir.set(Math.sin(angle), 0, Math.cos(angle));
        projectile.spawn(origin, this.fanDir, damage, weapon.speed, weapon.color, pierce, isCrit);
        firedAny = true;
      }
      if (firedAny) {
        this.particles.ring(origin, weapon.color, 12, 3.5, 0.35);
        this.cameraRig.addImpulse(0.08);
      }
      return firedAny;
    }

    const spread = weapon.count > 1 ? weapon.spread : 0;
    const baseAngle = Math.atan2(this.dirVec.x, this.dirVec.z);
    let firedAny = false;
    for (let i = 0; i < count; i += 1) {
      const projectile = this.projectiles.find((p) => !p.active);
      if (!projectile) break;
      const angle = baseAngle + (i - (count - 1) / 2) * spread;
      this.fanDir.set(Math.sin(angle), 0, Math.cos(angle));
      projectile.spawn(origin, this.fanDir, damage, weapon.speed, weapon.color, pierce, isCrit);
      firedAny = true;
    }
    return firedAny;
  }

  private updateProjectiles(delta: number): void {
    for (const projectile of this.projectiles) {
      if (projectile.active) projectile.update(delta);
    }
  }

  private updatePickups(delta: number): void {
    const magnetRadius = 2.6;
    for (const pickup of this.pickups) {
      if (pickup.active) pickup.update(delta, this.player.group.position, magnetRadius);
    }
  }

  private handleCollisions(): void {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        this.dirVec.copy(projectile.mesh.position).sub(enemy.group.position);
        this.dirVec.y = 0;
        const rr = projectile.radius + enemy.radius;
        if (this.dirVec.lengthSq() <= rr * rr) {
          enemy.takeDamage(projectile.damage);
          this.particles.burst(projectile.mesh.position, projectile.isCrit ? 10 : 5, projectile.isCrit ? '#ffe9a8' : '#ffb35c', 3.5, 0.4);
          if (projectile.onHit()) {
            // Pierced through — keep flying.
            continue;
          }
          if (!enemy.active) {
            this.kills += 1;
            this.audio.kill();
            this.cameraRig.addImpulse(0.1);
            this.pendingLevelUps += this.player.addXp(enemy.xpValue);
            const gold = Math.round(enemy.goldValue * (1 + this.player.stats.get('goldBonus')));
            this.dropGold(enemy.group.position, gold);
            if (enemy.boss) {
              this.bossActive = false;
              this.hud.setBossVisible(false);
              this.audio.bossDown();
              this.particles.ring(enemy.group.position, '#ffd9a0', 36, 12, 1);
              this.cameraRig.addImpulse(0.5);
            }
          }
          break;
        }
      }
    }

    // Pickup collection.
    for (const pickup of this.pickups) {
      if (!pickup.active) continue;
      this.dirVec.copy(pickup.mesh.position).sub(this.player.group.position);
      this.dirVec.y = 0;
      const rr = 0.75 + this.player.radius;
      if (this.dirVec.lengthSq() <= rr * rr) {
        this.player.addGold(pickup.value);
        this.hud.setGold(this.player.gold);
        this.audio.pickup();
        this.particles.burst(pickup.mesh.position, 5, '#f5ba49', 2.4, 0.35);
        pickup.despawn();
      }
    }

    if (!this.player.alive && this.state === 'playing') {
      this.state = 'gameover';
      this.audio.gameOver();
    }
  }

  private dropGold(position: THREE.Vector3, value: number): void {
    const pickup = this.pickups.find((p) => !p.active);
    if (!pickup) return;
    this.pickupOrigin.copy(position);
    this.pickupOrigin.y = 0.35;
    pickup.spawn(this.pickupOrigin, value);
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
    if (this.pendingLevelUps > 0) {
      this.openLevelUp();
    } else {
      this.state = 'playing';
    }
  }

  private cycleWeapon(): void {
    this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.ownedWeapons.length;
    this.hud.setWeapon(this.activeWeapon.name);
    this.audio.weaponSwitch();
    this.hud.flashStatus(`Weapon: ${this.activeWeapon.name}`);
  }

  // ── Shop ────────────────────────────────────────────────────────────────

  private openShop(): void {
    if (this.state === 'shop') {
      this.closeShop();
      return;
    }
    if (this.state !== 'playing') return;
    this.shopOffer = SHOP_WEAPONS.filter((w) => !this.ownedWeapons.includes(w.id));
    this.state = 'shop';
    this.hud.showShop(
      this.player.gold,
      this.shopOffer,
      this.shopUpgradeCost,
      (kind, id) => this.buyShopItem(kind, id),
      () => this.closeShop(),
    );
    this.audio.shopOpen();
    this.publishDiagnostics();
  }

  private buyShopItem(kind: 'weapon' | 'upgrade', id: string | null): void {
    if (kind === 'weapon' && id) {
      const weapon = WEAPONS[id];
      if (!weapon || this.ownedWeapons.includes(id)) return;
      if (!this.player.spendGold(weapon.price)) {
        this.audio.error();
        return;
      }
      this.ownedWeapons.push(id);
      this.hud.setGold(this.player.gold);
      this.hud.setWeapon(this.activeWeapon.name);
      this.audio.buy();
      this.hud.flashStatus(`Bought ${weapon.name}! Press Q to swap.`);
    } else if (kind === 'upgrade') {
      const cost = this.shopUpgradeCost;
      if (!this.player.spendGold(cost)) {
        this.audio.error();
        return;
      }
      this.shopUpgradeCount += 1;
      this.player.applyUpgrade({
        id: 'shop-power',
        name: 'Power Surge',
        description: '',
        weight: 0,
        effects: [{ stat: 'damage', op: 'mult', value: 1.12 }],
      });
      this.player.heal(20);
      this.hud.setGold(this.player.gold);
      this.audio.buy();
      this.hud.flashStatus('Power Surge: +12% damage, +20 HP');
    }
  }

  private closeShop(): void {
    if (this.state !== 'shop') return;
    this.state = 'playing';
    this.hud.hideShop();
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

    const emberPoint = new THREE.PointLight('#ff9d3f', 18, 14, 2);
    emberPoint.position.set(0, 1.4, 0);
    this.scene.add(emberPoint);

    this.scene.add(this.createArena());
    this.scene.add(this.player.group);
    this.scene.add(this.particles.points);
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

    // Faint ember crackle decals on the floor (cheap glow patches).
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const gctx = glowCanvas.getContext('2d');
    if (gctx) {
      const gradient = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(217, 79, 53, 0.5)');
      gradient.addColorStop(1, 'rgba(217, 79, 53, 0)');
      gctx.fillStyle = gradient;
      gctx.fillRect(0, 0, 64, 64);
    }
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowGeometry = new THREE.PlaneGeometry(1.6, 1.6);
    const glowCount = 14;
    for (let i = 0; i < glowCount; i += 1) {
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(
        (this.rng() * 2 - 1) * (ARENA.halfWidth - 2),
        0.02,
        (this.rng() * 2 - 1) * (ARENA.halfDepth - 2),
      );
      glow.scale.setScalar(0.7 + this.rng() * 1.6);
      arena.add(glow);
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
        else if (name === 'shop') this.openShop();
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
      buyWeapon: (id: string) => {
        if (!this.ownedWeapons.includes(id)) this.ownedWeapons.push(id);
      },
      addGold: (amount: number) => {
        this.player.addGold(amount);
        this.hud.setGold(this.player.gold);
      },
      spawnBossNow: () => {
        this.spawnBoss();
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
    this.bossSpawnedAt = 0;
    this.bossActive = false;
    this.shopUpgradeCount = 0;
    this.shopUpgradeCost = 25;
    this.ownedWeapons = [STARTING_WEAPON.id];
    this.activeWeaponIndex = 0;
    this.player.reset();
    for (const enemy of this.enemies) enemy.despawn();
    for (const projectile of this.projectiles) projectile.despawn();
    for (const pickup of this.pickups) pickup.despawn();
    this.hud.hideLevelUp();
    this.hud.hideShop();
    this.hud.setBossVisible(false);
    this.hud.setGold(0);
    this.hud.setWeapon(this.activeWeapon.name);
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
      gold: this.player.gold,
      weapon: this.activeWeapon.id,
      weapons: this.ownedWeapons.slice(),
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
        activePickups: this.pickups.filter((p) => p.active).length,
        bossActive: this.bossActive,
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
