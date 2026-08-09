import type { StatId } from '../game/Stats';

/** Weapon archetype: how the shot behaves in flight. */
export type WeaponKind = 'bolt' | 'lance' | 'nova';

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  kind: WeaponKind;
  /** Gold cost when bought in the shop. 0 = starting weapon. */
  price: number;
  damage: number;
  cooldown: number;
  /** Base projectile count per trigger pull. */
  count: number;
  /** Extra projectiles that pierce enemies instead of dying on hit. */
  pierce: number;
  /** Spread angle between fan projectiles (radians). */
  spread: number;
  speed: number;
  color: string;
  /** Crit multiplier when a shot crits. */
  critMult: number;
  /** Which stat scales this weapon's damage (weapon base * stat mult). */
  scaleStat: StatId;
}

export const WEAPONS: Record<string, WeaponDefinition> = {
  'ember-shot': {
    id: 'ember-shot',
    name: 'Ember Shot',
    description: 'Reliable ember bolt. Auto-aims at the nearest cinder.',
    kind: 'bolt',
    price: 0,
    damage: 12,
    cooldown: 0.34,
    count: 1,
    pierce: 0,
    spread: 0.16,
    speed: 16,
    color: '#ffd27f',
    critMult: 2,
    scaleStat: 'damage',
  },
  'cinder-lance': {
    id: 'cinder-lance',
    name: 'Cinder Lance',
    description: 'Slow, heavy lance that pierces through enemies.',
    kind: 'lance',
    price: 30,
    damage: 26,
    cooldown: 0.75,
    count: 1,
    pierce: 3,
    spread: 0,
    speed: 13,
    color: '#ff8f5a',
    critMult: 2.2,
    scaleStat: 'damage',
  },
  'nova-burst': {
    id: 'nova-burst',
    name: 'Nova Burst',
    description: 'Ring of embers — fires in every direction.',
    kind: 'nova',
    price: 55,
    damage: 9,
    cooldown: 1.1,
    count: 8,
    pierce: 0,
    spread: 0,
    speed: 11,
    color: '#ffd9a0',
    critMult: 1.8,
    scaleStat: 'damage',
  },
};

export const SHOP_WEAPONS: WeaponDefinition[] = [
  WEAPONS['cinder-lance'],
  WEAPONS['nova-burst'],
];

export const STARTING_WEAPON = WEAPONS['ember-shot'];
