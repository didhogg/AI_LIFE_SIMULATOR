// B5 · K5 约束取严 merge · 确定性验收测试
import { describe, it, expect } from 'vitest';
import { mergeInterventionDeltas, type K5DeltaEntry } from '../interfaces/interventionMerge.js';

// ── 空集 / 单包退化 ─────────────────────────────────────────────────────────

describe('B5 · K5 merge · 空集退化', () => {
  it('无包 → 空数组', () => {
    expect(mergeInterventionDeltas([])).toEqual([]);
  });
  it('单包空 deltas → 空数组', () => {
    expect(mergeInterventionDeltas([[]])).toEqual([]);
  });
  it('多包均空 → 空数组', () => {
    expect(mergeInterventionDeltas([[], [], []])).toEqual([]);
  });
});

describe('B5 · K5 merge · 单包退化（直通）', () => {
  it('单包单 set → 原样', () => {
    const d: K5DeltaEntry = { path: 'hp', op: 'set', value: 100 };
    expect(mergeInterventionDeltas([[d]])).toEqual([d]);
  });
  it('单包单 clamp → 原样', () => {
    const d: K5DeltaEntry = { path: 'hp', op: 'clamp', value: 80 };
    expect(mergeInterventionDeltas([[d]])).toEqual([d]);
  });
  it('单包单 lock → 原样', () => {
    const d: K5DeltaEntry = { path: 'hp', op: 'lock', value: 1 };
    expect(mergeInterventionDeltas([[d]])).toEqual([d]);
  });
  it('单包多 delta 不同路径 → 均保留', () => {
    const packs: K5DeltaEntry[][] = [[
      { path: 'hp', op: 'set', value: 100 },
      { path: 'mp', op: 'add', value: 10 },
    ]];
    const result = mergeInterventionDeltas(packs);
    expect(result).toHaveLength(2);
  });
});

// ── clamp 约束取严（数值取 min）───────────────────────────────────────────────

describe('B5 · K5 merge · clamp 约束取严', () => {
  it('两包 clamp 同路径数值：取较小值', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 100 }],
      [{ path: 'hp', op: 'clamp', value: 80 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'clamp', value: 80 }]);
  });
  it('三包 clamp：取最小值', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 200 }],
      [{ path: 'hp', op: 'clamp', value: 50 }],
      [{ path: 'hp', op: 'clamp', value: 120 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'clamp', value: 50 }]);
  });
  it('第一包值更小：第一包胜出', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 30 }],
      [{ path: 'hp', op: 'clamp', value: 200 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'clamp', value: 30 }]);
  });
  it('clamp DSL 串：后载覆盖（defer B6 DSL 求值）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: '0:100' }],
      [{ path: 'hp', op: 'clamp', value: '0:80' }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'clamp', value: '0:80' }]);
  });
  it('clamp 数值+DSL 串混合：后载覆盖（混合类型 defer B6）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 100 }],
      [{ path: 'hp', op: 'clamp', value: '0:80' }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'clamp', value: '0:80' }]);
  });
});

// ── lock 一旦置位不可解 ──────────────────────────────────────────────────────

describe('B5 · K5 merge · lock 一旦置位不可解', () => {
  it('单包有 lock → 输出包含 lock', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'name', op: 'lock', value: 1 }],
    ]);
    expect(result.some(d => d.path === 'name' && d.op === 'lock')).toBe(true);
  });
  it('多包均有 lock → 输出只有一个 lock 条目', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'lock', value: 100 }],
      [{ path: 'hp', op: 'lock', value: 200 }],
    ]);
    const locks = result.filter(d => d.path === 'hp' && d.op === 'lock');
    expect(locks).toHaveLength(1);
  });
  it('首包 value 定版（lock 置位后 value 不被后续包覆盖）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'lock', value: 100 }],
      [{ path: 'hp', op: 'lock', value: 999 }],
    ]);
    const lock = result.find(d => d.path === 'hp' && d.op === 'lock');
    expect(lock?.value).toBe(100);
  });
  it('第二包置 lock：输出仍含 lock', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'set', value: 50 }],
      [{ path: 'hp', op: 'lock', value: 1 }],
    ]);
    expect(result.some(d => d.op === 'lock')).toBe(true);
  });
  it('只有第一包有 lock，第二包无 lock → lock 仍在输出（不可解）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'lock', value: 1 }],
      [],
    ]);
    expect(result.some(d => d.op === 'lock')).toBe(true);
  });
});

// ── 内容后载覆盖（set/add/sub）──────────────────────────────────────────────

describe('B5 · K5 merge · 内容后载覆盖', () => {
  it('set：后包 value 覆盖前包', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'set', value: 100 }],
      [{ path: 'hp', op: 'set', value: 50 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'set', value: 50 }]);
  });
  it('三包 set：最后一包胜出', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'set', value: 100 }],
      [{ path: 'hp', op: 'set', value: 200 }],
      [{ path: 'hp', op: 'set', value: 30 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'set', value: 30 }]);
  });
  it('add：后包覆盖前包（非累加）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'gold', op: 'add', value: 10 }],
      [{ path: 'gold', op: 'add', value: 5 }],
    ]);
    expect(result).toEqual([{ path: 'gold', op: 'add', value: 5 }]);
  });
  it('sub：后包覆盖前包', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'gold', op: 'sub', value: 10 }],
      [{ path: 'gold', op: 'sub', value: 3 }],
    ]);
    expect(result).toEqual([{ path: 'gold', op: 'sub', value: 3 }]);
  });
  it('载入序决定胜出：第一包 value 若第二包也有 set，第二包胜', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'x', op: 'set', value: 'alpha' }],
      [{ path: 'x', op: 'set', value: 'beta' }],
    ]);
    expect(result[0]?.value).toBe('beta');
  });
});

// ── max_delta 跨包取 min ─────────────────────────────────────────────────────

describe('B5 · K5 merge · max_delta 取 min', () => {
  it('clamp：max_delta 两包取 min', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 100, max_delta: 20 }],
      [{ path: 'hp', op: 'clamp', value: 80, max_delta: 10 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'clamp', value: 80, max_delta: 10 }]);
  });
  it('set：max_delta 跨包取 min（不论谁的 value 胜出）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'set', value: 100, max_delta: 20 }],
      [{ path: 'hp', op: 'set', value: 50, max_delta: 5 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'set', value: 50, max_delta: 5 }]);
  });
  it('前包有 max_delta·后包无 → max_delta 保留（约束不松）', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'set', value: 100, max_delta: 10 }],
      [{ path: 'hp', op: 'set', value: 50 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'set', value: 50, max_delta: 10 }]);
  });
  it('两包均无 max_delta → 输出无 max_delta 键', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'set', value: 100 }],
      [{ path: 'hp', op: 'set', value: 50 }],
    ]);
    expect(result).toEqual([{ path: 'hp', op: 'set', value: 50 }]);
    expect('max_delta' in (result[0] ?? {})).toBe(false);
  });
  it('lock：max_delta 两包取 min', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'lock', value: 1, max_delta: 30 }],
      [{ path: 'hp', op: 'lock', value: 1, max_delta: 15 }],
    ]);
    const lock = result.find(d => d.op === 'lock');
    expect(lock?.max_delta).toBe(15);
  });
});

// ── 不同路径/op 互不干扰 ────────────────────────────────────────────────────

describe('B5 · K5 merge · 路径/op 独立归并', () => {
  it('不同路径的同 op 各自独立', () => {
    const result = mergeInterventionDeltas([
      [
        { path: 'hp', op: 'clamp', value: 100 },
        { path: 'mp', op: 'clamp', value: 200 },
      ],
      [
        { path: 'hp', op: 'clamp', value: 80 },
        { path: 'mp', op: 'clamp', value: 150 },
      ],
    ]);
    const hp = result.find(d => d.path === 'hp');
    const mp = result.find(d => d.path === 'mp');
    expect(hp?.value).toBe(80);
    expect(mp?.value).toBe(150);
  });
  it('同路径不同 op 均保留', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 100 }],
      [{ path: 'hp', op: 'set', value: 50 }],
    ]);
    expect(result.some(d => d.op === 'clamp')).toBe(true);
    expect(result.some(d => d.op === 'set')).toBe(true);
  });
  it('clamp 与 set 同路径：clamp 取最严·set 后载覆盖·各自独立', () => {
    const result = mergeInterventionDeltas([
      [{ path: 'hp', op: 'clamp', value: 100 }, { path: 'hp', op: 'set', value: 80 }],
      [{ path: 'hp', op: 'clamp', value: 60 }, { path: 'hp', op: 'set', value: 40 }],
    ]);
    const clamp = result.find(d => d.op === 'clamp');
    const set = result.find(d => d.op === 'set');
    expect(clamp?.value).toBe(60);  // min(100,60)
    expect(set?.value).toBe(40);    // last-writer-wins
  });
});

// ── 确定性（同输入同输出）───────────────────────────────────────────────────

describe('B5 · K5 merge · 确定性', () => {
  const PACKS: K5DeltaEntry[][] = [
    [{ path: 'hp', op: 'clamp', value: 100 }, { path: 'mp', op: 'set', value: 50 }],
    [{ path: 'hp', op: 'clamp', value: 80 }, { path: 'gold', op: 'add', value: 10 }],
    [{ path: 'mp', op: 'set', value: 30 }, { path: 'hp', op: 'lock', value: 1 }],
  ];
  it('同输入双跑相同', () => {
    expect(mergeInterventionDeltas(PACKS)).toEqual(mergeInterventionDeltas(PACKS));
  });
  it('100 次循环无漂移', () => {
    const ref = JSON.stringify(mergeInterventionDeltas(PACKS));
    for (let i = 0; i < 99; i++) {
      expect(JSON.stringify(mergeInterventionDeltas(PACKS))).toBe(ref);
    }
  });
});

// ── 输出排序（码点序·禁 localeCompare）─────────────────────────────────────

describe('B5 · K5 merge · 输出码点序排列', () => {
  it('按 path 码点序排列', () => {
    const result = mergeInterventionDeltas([[
      { path: 'z_path', op: 'set', value: 1 },
      { path: 'a_path', op: 'set', value: 2 },
      { path: 'm_path', op: 'set', value: 3 },
    ]]);
    expect(result.map(d => d.path)).toEqual(['a_path', 'm_path', 'z_path']);
  });
  it('同 path 按 op 码点序排列（add < clamp < lock < set < sub）', () => {
    const result = mergeInterventionDeltas([[
      { path: 'x', op: 'set', value: 1 },
      { path: 'x', op: 'clamp', value: 2 },
      { path: 'x', op: 'add', value: 3 },
    ]]);
    expect(result.map(d => d.op)).toEqual(['add', 'clamp', 'set']);
  });
  it('混合路径+op 综合排序正确', () => {
    const result = mergeInterventionDeltas([[
      { path: 'z', op: 'set', value: 1 },
      { path: 'a', op: 'set', value: 2 },
      { path: 'a', op: 'clamp', value: 3 },
    ]]);
    expect(result[0]).toMatchObject({ path: 'a', op: 'clamp' });
    expect(result[1]).toMatchObject({ path: 'a', op: 'set' });
    expect(result[2]).toMatchObject({ path: 'z', op: 'set' });
  });
});
