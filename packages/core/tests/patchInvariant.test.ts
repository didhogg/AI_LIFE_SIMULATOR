// B5 · M3 规则补丁负面清单 · 确定性验收测试
import { describe, it, expect } from 'vitest';
import {
  M3_HARD_EXCLUDED_PREFIXES,
  M3_FORWARD_ONLY_PATHS,
  isM3HardExcluded,
  isM3ForwardOnlyViolation,
  getM3Violation,
} from '../interfaces/patchInvariant.js';
import { intervention_pack_v1Schema } from '../schema/memory.js';

// ── 常量冻结 ─────────────────────────────────────────────────────────────────

describe('B5 · M3 · 常量冻结', () => {
  it('M3_HARD_EXCLUDED_PREFIXES 为冻结数组', () => {
    expect(Object.isFrozen(M3_HARD_EXCLUDED_PREFIXES)).toBe(true);
  });
  it('M3_FORWARD_ONLY_PATHS 为冻结数组', () => {
    expect(Object.isFrozen(M3_FORWARD_ONLY_PATHS)).toBe(true);
  });
  it('硬排除前缀包含「_」和「$」', () => {
    expect(M3_HARD_EXCLUDED_PREFIXES).toContain('_');
    expect(M3_HARD_EXCLUDED_PREFIXES).toContain('$');
  });
});

// ── isM3HardExcluded · 硬排除命中 ──────────────────────────────────────────

describe('B5 · M3 · isM3HardExcluded · 「_」开头命中', () => {
  it('_作弊标记 → 命中', () => expect(isM3HardExcluded('_作弊标记')).toBe(true));
  it('_mod墓碑库 → 命中', () => expect(isM3HardExcluded('_mod墓碑库')).toBe(true));
  it('_覆写日志 → 命中', () => expect(isM3HardExcluded('_覆写日志')).toBe(true));
  it('_编年史 → 命中', () => expect(isM3HardExcluded('_编年史')).toBe(true));
  it('嵌套路径：_编年史.序号 → 命中', () => expect(isM3HardExcluded('_编年史.序号')).toBe(true));
  it('嵌套路径：_mod墓碑库.mod_alpha → 命中', () => expect(isM3HardExcluded('_mod墓碑库.mod_alpha')).toBe(true));
});

describe('B5 · M3 · isM3HardExcluded · 「$」开头命中', () => {
  it('$谜底 → 命中', () => expect(isM3HardExcluded('$谜底')).toBe(true));
  it('$天命重掷券 → 命中', () => expect(isM3HardExcluded('$天命重掷券')).toBe(true));
  it('$存档种子 → 命中', () => expect(isM3HardExcluded('$存档种子')).toBe(true));
  it('嵌套路径：$生图配置.model → 命中', () => expect(isM3HardExcluded('$生图配置.model')).toBe(true));
});

describe('B5 · M3 · isM3HardExcluded · 合法路径放行', () => {
  it('属性.体质 → 不命中', () => expect(isM3HardExcluded('属性.体质')).toBe(false));
  it('货币.金币 → 不命中', () => expect(isM3HardExcluded('货币.金币')).toBe(false));
  it('hp（扁平路径）→ 不命中', () => expect(isM3HardExcluded('hp')).toBe(false));
  it('编年史.序号（非 _ 开头）→ 不命中（硬排除只管「_」/「$」前缀）', () => {
    expect(isM3HardExcluded('编年史.序号')).toBe(false);
  });
  it('包含下划线但不以「_」开头 → 不命中', () => {
    expect(isM3HardExcluded('mod_alpha.value')).toBe(false);
    expect(isM3HardExcluded('flag_set')).toBe(false);
  });
  it('包含「$」但不以「$」开头 → 不命中', () => {
    expect(isM3HardExcluded('value$extra')).toBe(false);
  });
});

// ── isM3ForwardOnlyViolation · forward-only 逆向拒收 ────────────────────────

describe('B5 · M3 · isM3ForwardOnlyViolation · forward-only 路径逆向违例', () => {
  for (const path of M3_FORWARD_ONLY_PATHS) {
    it(`路径「${path}」+ sub → 逆向违例（true）`, () => {
      expect(isM3ForwardOnlyViolation(path, 'sub')).toBe(true);
    });
    it(`路径「${path}」+ add → 合法（false）`, () => {
      expect(isM3ForwardOnlyViolation(path, 'add')).toBe(false);
    });
    it(`路径「${path}」+ set → isM3ForwardOnlyViolation 合法（值比较由 getM3Violation 处理）`, () => {
      expect(isM3ForwardOnlyViolation(path, 'set')).toBe(false);
    });
    it(`路径「${path}」+ clamp → 合法`, () => {
      expect(isM3ForwardOnlyViolation(path, 'clamp')).toBe(false);
    });
  }
  it('非 forward-only 路径 + sub → 不违例', () => {
    expect(isM3ForwardOnlyViolation('属性.体质', 'sub')).toBe(false);
    expect(isM3ForwardOnlyViolation('货币.金币', 'sub')).toBe(false);
    expect(isM3ForwardOnlyViolation('hp', 'sub')).toBe(false);
  });
});

// ── getM3Violation · 综合检验 ────────────────────────────────────────────────

describe('B5 · M3 · getM3Violation · 综合检验', () => {
  it('硬排除路径 → 返回非 null 违例消息', () => {
    expect(getM3Violation('_作弊标记', 'set')).not.toBeNull();
    expect(getM3Violation('$谜底', 'add')).not.toBeNull();
  });
  it('硬排除消息含「M3」和路径', () => {
    const msg = getM3Violation('_编年史', 'lock');
    expect(msg).toContain('M3');
    expect(msg).toContain('_编年史');
  });
  it('forward-only 逆向 → 返回非 null 违例消息', () => {
    expect(getM3Violation('编年史.序号', 'sub')).not.toBeNull();
    expect(getM3Violation('落账记录.序号', 'sub')).not.toBeNull();
  });
  it('forward-only 消息含「M3」和路径', () => {
    const msg = getM3Violation('编年史.序号', 'sub');
    expect(msg).toContain('M3');
    expect(msg).toContain('编年史.序号');
  });
  it('合法路径+op → null', () => {
    expect(getM3Violation('属性.体质', 'add')).toBeNull();
    expect(getM3Violation('货币.金币', 'sub')).toBeNull();
    expect(getM3Violation('hp', 'set')).toBeNull();
    expect(getM3Violation('编年史.序号', 'add')).toBeNull();
  });
  it('确定性：相同输入多次调用结果恒等', () => {
    const a1 = getM3Violation('_作弊标记', 'set');
    const a2 = getM3Violation('_作弊标记', 'set');
    expect(a1).toBe(a2);
    const b1 = getM3Violation('hp', 'add');
    const b2 = getM3Violation('hp', 'add');
    expect(b1).toBe(b2);
  });
});

// ── ⊕-3 · getM3Violation · forward-only set 值比较（B6 新增） ─────────────────

describe('⊕-3 · M3 · getM3Violation · forward-only set 值比较', () => {
  it('set 正向递增（newValue > oldValue）→ null（放行）', () => {
    expect(getM3Violation('编年史.序号', 'set', 5, 10)).toBeNull();
  });

  it('set 等值（newValue === oldValue）→ null（非回退·放行）', () => {
    expect(getM3Violation('编年史.序号', 'set', 5, 5)).toBeNull();
  });

  it('set 回退（newValue < oldValue）→ 违例消息含「M3」和「forward-only」', () => {
    const msg = getM3Violation('编年史.序号', 'set', 10, 5);
    expect(msg).not.toBeNull();
    expect(msg).toContain('M3');
    expect(msg).toContain('forward-only');
  });

  it('set 无 oldValue/newValue（两参调用）→ null（向下兼容·跳过值比较）', () => {
    expect(getM3Violation('编年史.序号', 'set')).toBeNull();
  });

  it('set + 非 number 新旧值 → 违例（fail-closed）', () => {
    const msg = getM3Violation('编年史.序号', 'set', 5, '十');
    expect(msg).not.toBeNull();
    expect(msg).toContain('M3');
  });

  it('落账记录.序号 set 回退 → 违例', () => {
    const msg = getM3Violation('落账记录.序号', 'set', 100, 50);
    expect(msg).not.toBeNull();
    expect(msg).toContain('落账记录.序号');
  });

  it('非 forward-only 路径 set 回退 → null（M3 不管）', () => {
    expect(getM3Violation('属性.体质', 'set', 10, 1)).toBeNull();
  });
});

// ── M3 schema superRefine 集成（intervention_pack_v1Schema） ─────────────────

describe('B5 · M3 · schema superRefine 集成', () => {
  it('硬排除路径「_」开头 → safeParse 拒收', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_m3',
      deltas: [{ path: '_作弊标记', op: 'set', value: 1 }],
    }).success).toBe(false);
  });
  it('硬排除路径「$」开头 → safeParse 拒收', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_m3',
      deltas: [{ path: '$谜底', op: 'add', value: 1 }],
    }).success).toBe(false);
  });
  it('forward-only 路径 + sub → safeParse 拒收', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_m3',
      deltas: [{ path: '编年史.序号', op: 'sub', value: 1 }],
    }).success).toBe(false);
  });
  it('合法路径（普通游戏属性 + sub）→ safeParse 通过（M3 不管）', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_m3',
      deltas: [{ path: '属性.体质', op: 'sub', value: 5 }],
    }).success).toBe(true);
  });
  it('forward-only 路径 + add → safeParse 通过', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_m3',
      deltas: [{ path: '编年史.序号', op: 'add', value: 1 }],
    }).success).toBe(true);
  });
  it('deltas 缺省（无 deltas 字段）→ safeParse 通过', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_m3',
    }).success).toBe(true);
  });
});
