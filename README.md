# Emberfield

A polished, playable Three.js survivor game — auto-aim, waves of cinders, gold economy, a shop, weapon swapping, and a boss. Runs entirely in the browser; no backend.

## Play

`npm install && npm run dev` → open http://127.0.0.1:5173

**Controls**
- `WASD` / arrows — move
- Auto-aim fires at the nearest enemy (no manual aiming needed)
- `B` — open the shop (gold economy)
- `Q` — swap weapons (after buying a second one)
- `R` — retry after game over
- Touch: virtual stick + Fire/Shop buttons on mobile

## Features

- **Survivor loop** — waves of cinders/embers/brutes/wisps scale over time
- **Boss** — Infernal Core spawns every 45s with a dedicated HUD bar
- **XP & level-ups** — 8 weighted upgrades, 3 distinct choices per level
- **Gold economy** — enemies drop gold, magnetized pickups; shop sells weapons + Power Surge upgrades
- **3 weapons** — Ember Shot (starter), Cinder Lance (piercing), Nova Burst (ring)
- **VFX** — pooled additive particle bursts, projectile trails, coin glow, screen shake
- **Audio** — procedural Web Audio synth (no assets), all effects generated at runtime
- **Responsive** — desktop + mobile touch controls, safe-area aware
- **Performance** — object pooling everywhere (enemies, projectiles, pickups, particles); no allocation during combat; capped DPR

## Tech

- TypeScript + Vite
- Three.js (WebGL, shadow-mapped directional light, fog, orthographic chase camera)
- lil-gui (dev-only, `?debug` query param)
- Playwright (QA scripts)

## QA

```bash
npm run build          # tsc + vite build
npm run dev            # local server
node pw_qa.mjs         # full gameplay/UI/mobile test suite (needs PLAYWRIGHT_CHROMIUM_PATH)
```

Test hooks (`window.__THREE_GAME_TEST_HOOKS__`) expose seed/state/gold/weapon/boss helpers for deterministic browser QA.

## Project structure

```
src/
  core/       renderer, loop, input
  entities/   player, enemy, projectile, pickup
  game/       Game orchestration, stat block
  data/       upgrades, weapons (data-driven)
  systems/    audio, camera, HUD, particles, debug tools
  utils/      seeded rng, dispose helpers
```

## License

Private project. Not for redistribution.
