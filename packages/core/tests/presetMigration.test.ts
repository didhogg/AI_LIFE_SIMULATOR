// PR-瘦身-底座-5 · 阶段C 验收测试
//   C1-残 · 玩法预设Schema 残留断言：已迁13个规则字段均不在 .shape
//   C2   · shimThickPreset + resolve() 规则成品 round-trip 等价
//   C4   · 开局装配数据Schema 不含家境装配包
//   manifest · packs/rules 字段在 玩法预设Schema.shape
// 纯函数·无副作用·禁 Date.now/Math.random

import { describe, it, expect } from 'vitest';
import { 玩法预设Schema } from '../schema/preset.js';
import { resolve, shimThickPreset, 规则字段名集 } from '../engine/preset/resolve.js';
import { 开局装配数据Schema } from '../engine/preset/contentPack.js';

// ── C1 · 残留断言：13 个规则字段均不在 玩法预设Schema.shape ─────────────────────

describe('C1 · 玩法预设Schema 规则字段残留断言', () => {
  const shape = 玩法预设Schema.shape;
  const ruleFields = [...规则字段名集];

  it('规则字段名集 = 13 项', () => {
    expect(ruleFields).toHaveLength(13);
  });

  for (const field of ruleFields) {
    it(`"${field}" 不在 玩法预设Schema.shape`, () => {
      expect(Object.prototype.hasOwnProperty.call(shape, field)).toBe(false);
    });
  }

  it('薄清单字段 packs 在 玩法预设Schema.shape', () => {
    expect(Object.prototype.hasOwnProperty.call(shape, 'packs')).toBe(true);
  });

  it('薄清单字段 rules 在 玩法预设Schema.shape', () => {
    expect(Object.prototype.hasOwnProperty.call(shape, 'rules')).toBe(true);
  });
});

// ── C4 · 家境装配包 已从 开局装配数据Schema 删除 ──────────────────────────────────

describe('C4 · 开局装配数据Schema 不含 家境装配包', () => {
  it('开局装配数据Schema.shape 不含 家境装配包', () => {
    expect(Object.prototype.hasOwnProperty.call(开局装配数据Schema.shape, '家境装配包')).toBe(false);
  });

  it('开局装配数据Schema.parse({}) 不含 家境装配包', () => {
    const res = 开局装配数据Schema.parse({});
    expect((res as Record<string, unknown>)['家境装配包']).toBeUndefined();
  });
});

// ── C2 · shimThickPreset + resolve() round-trip ────────────────────────────────

describe('C2 · shimThickPreset round-trip 等价', () => {
  const THICK_PRESET_RULES = {
    难度系数组: { 基础成功率调整: 5, 秘密暴露系数: 2 },
    检定骰面: { 判定骰型: 20, 暴击映射: '关' },
    钳制表: { 按重要等级: { 核心: 30 }, 按字段: {} },
    归并表: { 测试键: '测试值' },
  };

  it('shimThickPreset 提取规则字段 → manifest.rules=[shim] · ruleLib.shim 含规则面', () => {
    const result = shimThickPreset(THICK_PRESET_RULES as Record<string, unknown>);
    expect(result.manifest.rules).toEqual(['shim']);
    expect(result.ruleLib['shim']).toBeDefined();
    expect(result.ruleLib['shim']!.规则面).toBeDefined();
  });

  it('shimThickPreset + resolve() 规则成品 等价原始规则字段（round-trip）', () => {
    const result = shimThickPreset(THICK_PRESET_RULES as Record<string, unknown>);
    const resolved = resolve(result.manifest, {}, result.ruleLib);
    expect(resolved.规则成品['难度系数组']).toEqual(THICK_PRESET_RULES.难度系数组);
    expect(resolved.规则成品['钳制表']).toEqual(THICK_PRESET_RULES.钳制表);
    expect(resolved.规则成品['归并表']).toEqual(THICK_PRESET_RULES.归并表);
  });

  it('shimThickPreset 对无规则字段的 preset 返回空 ruleLib + 空 manifest.rules', () => {
    const result = shimThickPreset({ 预设ID: 'empty', 名称: '空预设' });
    expect(result.manifest.rules).toBeUndefined();
    expect(Object.keys(result.ruleLib)).toHaveLength(0);
  });

  it('shimThickPreset 保留 packs 字段', () => {
    const result = shimThickPreset({ packs: ['pack_a', 'pack_b'] });
    expect(result.manifest.packs).toEqual(['pack_a', 'pack_b']);
  });

  it('shimThickPreset 纯函数·确定性（两次调用输出逐位恒等）', () => {
    const r1 = shimThickPreset(THICK_PRESET_RULES as Record<string, unknown>);
    const r2 = shimThickPreset(THICK_PRESET_RULES as Record<string, unknown>);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ── C1 · 玩法预设Schema packs 默认值 ────────────────────────────────────────────

describe('C1 · 薄清单字段默认值', () => {
  it('packs 默认值为 [] (空数组)', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.packs).toEqual([]);
  });

  it('rules 默认值为 undefined (optional)', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.rules).toBeUndefined();
  });

  it('packs 可传字符串数组', () => {
    const res = 玩法预设Schema.parse({ packs: ['pack_a', 'pack_b'] });
    expect(res.packs).toEqual(['pack_a', 'pack_b']);
  });

  it('rules 可传字符串数组', () => {
    const res = 玩法预设Schema.parse({ rules: ['rule_a'] });
    expect(res.rules).toEqual(['rule_a']);
  });
});
