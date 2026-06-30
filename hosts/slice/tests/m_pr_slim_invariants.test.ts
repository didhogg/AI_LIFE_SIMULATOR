// m_pr_slim_invariants.test.ts — 预设瘦身验收不变量
//
// 不变量 1：预设不引用经济内容包 → resolve() 无经济字段 + economyEngine 退化（不崩）
// 不变量 2：空薄清单预设 → resolve() 无任何域模块字段
// 不变量 3：玩法预设骨架字段校验（migration_version + 薄清单 + 元数据）
// 不变量 4：规则面含 ③1A 四字段；内容包条目含 ③1D 三字段
import { describe, it, expect } from 'vitest';
import { resolve } from '../../../packages/core/engine/preset/resolve.js';
import { deriveEffectivePrice, applyDriftCandidate } from '../../../packages/core/engine/economyEngine.js';
import { 玩法预设Schema } from '../../../packages/core/schema/index.js';
import { 规则面Schema } from '../../../packages/core/engine/preset/ruleLibrary.js';
import { 内容包条目Schema } from '../../../packages/core/engine/preset/contentPack.js';
import { swapPreset } from '../../../packages/core/engine/presetSwap.js';
import { RootSchema } from '../../../packages/core/schema/index.js';
import type { RootState } from '../../../packages/core/schema/index.js';

// ── 辅助：最小有效 state ────────────────────────────────────────────────────
function makeMinimalState(): RootState {
  return {
    角色: {},
    知识库: {},
    物品库: {},
    物品栏: {},
    任务栏: {},
    编年史: {},
    关系网络: {},
    文明数据: {},
    统计: {},
    货币系统: { 账户: {} },
    战争状态: {},
    全局: {},
    地图: {},
    认知档案: {},
    组织数据: {},
    叙事系统: {},
    会话状态: {},
    LOD表: {},
    区域数据: {},
    _tick: { 拍计数: 0 },
    $meta: { 预设ID: '', 预设版本: '0.1.0', 内容包版本哈希: '', 指纹哈希: '' },
  } as unknown as RootState;
}

// ── 不变量 1：无经济内容包 ─────────────────────────────────────────────────
describe('预设瘦身不变量 1：无经济包 → 经济字段 absent + engine 退化不崩', () => {
  const emptyLib = {};
  const manifest = { packs: [] };
  const result = resolve(manifest, emptyLib);

  it('resolve() 无经济字段（聚合経済生成規則 = undefined）', () => {
    expect((result as Record<string, unknown>)['聚合経済生成規則']).toBeUndefined();
  });

  it('deriveEffectivePrice 退化：economyRule=undefined → 返回 0（无区域物价）', () => {
    const state = makeMinimalState();
    const price = deriveEffectivePrice(state, undefined, '测试区域', '粮食');
    expect(price).toBe(0);
  });

  it('applyDriftCandidate 退化：economyRule=undefined → no-op 不崩', () => {
    const state = makeMinimalState();
    expect(() => applyDriftCandidate(state, undefined, '测试区域', '粮食')).not.toThrow();
  });
});

// ── 不变量 2：空薄清单 → 无任何域模块字段 ────────────────────────────────────
describe('预设瘦身不变量 2：空薄清单 → resolve() 无域模块字段', () => {
  const emptyLib = {};
  const manifest = { packs: [] };
  const result = resolve(manifest, emptyLib);

  const domainFields = [
    '历法皮肤',
    '财富分档参数',
    '欠债参数',
    '穿越契约',
    '开局装配数据',
    '聚合経済生成規則',
    '种族模板成品',
    '战术包成品',
    '母题配额成品',
  ] as const;

  for (const field of domainFields) {
    it(`resolve() 不含 ${field}`, () => {
      const val = (result as Record<string, unknown>)[field];
      const isEmpty = val === undefined
        || (typeof val === 'object' && val !== null && Object.keys(val).length === 0);
      expect(isEmpty, `${field} should be absent or empty`).toBe(true);
    });
  }
});

// ── 不变量 3：玩法预设骨架字段校验 ───────────────────────────────────────────
describe('预设瘦身不变量 3：玩法预设骨架字段校验', () => {
  it('玩法预设 parse({}) 含所有骨架字段', () => {
    const p = 玩法预设Schema.parse({});
    expect(p.预设ID).toBe('');
    expect(p.名称).toBe('');
    expect(p.版本).toBe('0.1.0');
    expect(p.作者).toBe('');
    expect(p.描述).toBe('');
    expect(p.migration_version).toBe(0);
    expect(p.packs).toEqual([]);
  });

  it('玩法预设不含已迁出的域字段', () => {
    const shape = 玩法预设Schema.shape;
    expect((shape as Record<string, unknown>)['媒介登记表']).toBeUndefined();
    expect((shape as Record<string, unknown>)['叙事分发表']).toBeUndefined();
    expect((shape as Record<string, unknown>)['母题词汇表']).toBeUndefined();
    expect((shape as Record<string, unknown>)['実体模板库']).toBeUndefined();
  });

  it('packs 字段支持字符串数组', () => {
    const p = 玩法预设Schema.parse({ packs: ['pack-a', 'pack-b'] });
    expect(p.packs).toEqual(['pack-a', 'pack-b']);
  });

  it('migration_version 最小值 0·负数拒绝', () => {
    expect(玩法预设Schema.safeParse({ migration_version: -1 }).success).toBe(false);
    expect(玩法预设Schema.safeParse({ migration_version: 0 }).success).toBe(true);
    expect(玩法预设Schema.safeParse({ migration_version: 5 }).success).toBe(true);
  });
});

// ── 不变量 4：规则面含 ③1A 四字段；内容包含 ③1D 三字段 ──────────────────────
describe('预设瘦身不变量 4：规则面 + 内容包新字段 schema 存在', () => {
  it('规则面含 ③1A 四字段', () => {
    const shape = 规则面Schema.shape;
    expect('粒度模板覆盖' in shape).toBe(true);
    expect('纠缠闭包弱边阈值' in shape).toBe(true);
    expect('约定谓词集' in shape).toBe(true);
    expect('级联限制' in shape).toBe(true);
  });

  it('内容包条目含 ③1D 三字段（parse round-trip 验证）', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'test_pack',
      世界遗产白名单出厂值: ['item_a'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.世界遗产白名单出厂值).toEqual(['item_a']);
  });

  it('内容包 角色激活配置 parse 合法值', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'test_pack',
      角色激活配置: { 激活上限: 10, 沉默下限: 2 },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.角色激活配置).toEqual({ 激活上限: 10, 沉默下限: 2 });
  });

  it('内容包 事件来源权重出厂值 parse 合法值', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'test_pack',
      事件来源权重出厂值: { 事件包: 70, AI自发: 30 },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.事件来源权重出厂值?.事件包).toBe(70);
  });
});

// ── 不变量 5：swapPreset 旧格式预设自动 migration_version +1 ─────────────────
describe('预设瘦身不变量 5：swapPreset 旧格式预设 migration 探测', () => {
  const baseState = RootSchema.parse({
    世界域: { main: { 玩法预设引用: '' } },
    _存档头: { 版本段记录: [] },
  }) as unknown as RootState;

  it('新格式预设（无额外键）→ presetMigrated=false·effectiveMigrationVersion=0', () => {
    const freshPreset = { 预设ID: 'slim_v1', packs: [] };
    const r = swapPreset(baseState, freshPreset, { domainId: 'main', engineVersion: 'v1' });
    expect(r.presetMigrated).toBe(false);
    expect(r.effectiveMigrationVersion).toBe(0);
  });

  it('旧格式预设（含已删域字段）→ presetMigrated=true·effectiveMigrationVersion=1', () => {
    const legacyPreset = { 预设ID: 'fat_v0', packs: [], 叙事分发表: {}, 母题词汇表: {} };
    const r = swapPreset(baseState, legacyPreset, { domainId: 'main', engineVersion: 'v1' });
    expect(r.presetMigrated).toBe(true);
    expect(r.effectiveMigrationVersion).toBe(1);
  });
});
