/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  state: string;
  wave: number;
  kills: number;
  hp: number;
  level: number;
  xp: number;
  gold: number;
  weapon: string;
  weapons: string[];
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
  };
  entities: {
    activeEnemies: number;
    activeProjectiles: number;
    activePickups: number;
    activeEnemyProjectiles: number;
    activeOrbs: number;
    bossActive: boolean;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface ThreeGameTestHooks {
  /** Re-seed the game RNG; all gameplay randomness must flow through it. */
  seed(value: number): void;
  /** Jump to a named state for baselines ('active-play' | 'gameover' | 'victory' | 'shop'). */
  setState(name: string): void;
  /** Freeze the simulation while continuing to render the current frame. */
  setPausedForScreenshot(paused: boolean): void;
  /** Freeze ambient/idle animation time so screenshots are stable. */
  setReducedMotion(enabled: boolean): void;
  /** Hide debug UI (lil-gui) before capturing. */
  hideDebugUi(hidden: boolean): void;
  /** Grant a weapon without gold (QA helper). */
  buyWeapon(id: string): void;
  /** Grant gold (QA helper). */
  addGold(amount: number): void;
  /** Force a boss spawn immediately (QA helper). */
  spawnBossNow(): void;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
}
