/** Data-driven stat block. Upgrades are defined as data (StatEffect[]),
 *  not as switch statements, so new upgrades need zero engine changes. */

export type StatId =
  | 'damage'
  | 'attackSpeed'
  | 'projectileCount'
  | 'maxHp'
  | 'moveSpeed'
  | 'critChance'
  | 'pierce'
  | 'goldBonus';

export type StatOp = 'add' | 'mult' | 'set';

export interface StatEffect {
  stat: StatId;
  op: StatOp;
  value: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  weight: number;
  effects: StatEffect[];
  /** Optional flat heal applied when the upgrade is taken. */
  heal?: number;
}

const DEFAULT_ADD: Record<StatId, number> = {
  damage: 0,
  attackSpeed: 0,
  projectileCount: 0,
  maxHp: 0,
  moveSpeed: 0,
  critChance: 0,
  pierce: 0,
  goldBonus: 0,
};

const DEFAULT_MULT: Record<StatId, number> = {
  damage: 1,
  attackSpeed: 1,
  projectileCount: 1,
  maxHp: 1,
  moveSpeed: 1,
  critChance: 1,
  pierce: 1,
  goldBonus: 1,
};

export class StatBlock {
  private readonly base: Record<StatId, number>;
  private readonly add: Record<StatId, number>;
  private readonly mult: Record<StatId, number>;
  private readonly set: Partial<Record<StatId, number>> = {};

  constructor(base: Record<StatId, number>) {
    this.base = { ...base };
    this.add = { ...DEFAULT_ADD };
    this.mult = { ...DEFAULT_MULT };
  }

  apply(effect: StatEffect): void {
    if (effect.op === 'add') this.add[effect.stat] += effect.value;
    else if (effect.op === 'mult') this.mult[effect.stat] *= effect.value;
    else this.set[effect.stat] = effect.value;
  }

  get(stat: StatId): number {
    if (this.set[stat] !== undefined) return this.set[stat] as number;
    return (this.base[stat] + this.add[stat]) * this.mult[stat];
  }
}
