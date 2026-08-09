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
  {
    id: 'sharp-aim',
    name: 'Sharp Aim',
    description: '+10% crit chance',
    weight: 7,
    effects: [{ stat: 'critChance', op: 'add', value: 0.1 }],
  },
  {
    id: 'piercing-core',
    name: 'Piercing Core',
    description: 'Shots pierce +1 enemy',
    weight: 6,
    effects: [{ stat: 'pierce', op: 'add', value: 1 }],
  },
  {
    id: 'gold-finder',
    name: 'Gold Finder',
    description: '+50% gold from cinders',
    weight: 6,
    effects: [{ stat: 'goldBonus', op: 'add', value: 0.5 }],
  },
];
