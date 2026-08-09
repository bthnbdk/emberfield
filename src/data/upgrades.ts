import type { UpgradeDefinition } from '../game/Stats';

/** Level-up upgrade pool. Weighted; the level-up screen draws 3 distinct picks. */
export const UPGRADES: UpgradeDefinition[] = [
  {
    id: 'ember-grip',
    name: 'Ember Grip',
    description: '+25% damage',
    weight: 10,
    effects: [{ stat: 'damage', op: 'mult', value: 1.25 }],
  },
  {
    id: 'quick-fuse',
    name: 'Quick Fuse',
    description: '+20% attack speed',
    weight: 10,
    effects: [{ stat: 'attackSpeed', op: 'mult', value: 1.2 }],
  },
  {
    id: 'twin-sparks',
    name: 'Twin Sparks',
    description: '+1 projectile (fan spread)',
    weight: 8,
    effects: [{ stat: 'projectileCount', op: 'add', value: 1 }],
  },
  {
    id: 'cinder-heart',
    name: 'Cinder Heart',
    description: '+15 max HP, heal 15',
    weight: 9,
    effects: [{ stat: 'maxHp', op: 'add', value: 15 }],
    heal: 15,
  },
  {
    id: 'swift-steps',
    name: 'Swift Steps',
    description: '+12% move speed',
    weight: 8,
    effects: [{ stat: 'moveSpeed', op: 'mult', value: 1.12 }],
  },
];
