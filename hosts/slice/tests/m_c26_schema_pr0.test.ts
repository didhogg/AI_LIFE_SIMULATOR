// C2-6 · PR-0 预设 schema additive 留位 · 快照恒等证明
//
// 验收门：
//   PR0-1  新预设字段默认 undefined → 不影响 hashJudgmentBundle / hashPresetFingerprint
//   PR0-2  新地图字段默认 undefined → 地点节点解析正常·指纹零变
//   PR0-3  新 全局._factFragment种子库 默认 undefined → 解析正常·_编年史/指纹不受影响
//   PR0-4  manifest=85 / schemaKeys=52 守恒（C2-6 additive 不改任何数组）
//   PR0-5  双宿主快照恒等：C2-6 新字段全空跑·canonicalize 输出逐位不变
//   PR0-6  factFragment 种子条目：访问阈值/有锚布尔 默认值正确
import { describe, it, expect } from 'vitest';
import {
  RootSchema,
  BLUEPRINT_KEYS,
  玩法预设Schema,
  地图Schema,
  全局Schema,
} from '../../../packages/core/schema/index.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../../../packages/core/engine/fingerprintManifest.js';
import { hashJudgmentBundle } from '../../../packages/core/engine/rng.js';
import { canonicalize } from '../../../packages/core/engine/text/canonicalize.js';

// ── 基线指纹（新字段全不传·与 C2-T 基线恒等）────────────────────────────────────
const BASE_BUNDLE = {
  历法皮肤: {},
  粒度模板覆盖: {},
  种族模板: {},
  母题配额: {},
  媒体渠道表: {},
  检定配方表: {},
  检定档切分表: {},
  欠债参数: {},
  赛事结构模板: {},
  派生量配方: {},
  概率域夹逼: { p_最小: 0.0001, p_最大: 0.9999 },
  纠缠闭包弱边阈值: 0.2,
} as const;

describe('PR0-1 · 新预设字段不影响 judgment bundle 指纹', () => {
  it('玩法预设Schema 解析带新字段 → 新字段 undefined', () => {
    const p = 玩法预设Schema.parse({});
    expect(p.父预设).toBeUndefined();
    expect(p.创建时预设版本).toBeUndefined();
    expect(p.派生标记).toBeUndefined();
    expect(p.默认模板).toBeUndefined();
    expect(p.经济生成规则).toBeUndefined();
    expect(p.社会熵默认值).toBeUndefined();
  });

  it('hashJudgmentBundle 带/不带新字段·输出逐位恒等', () => {
    const h1 = hashJudgmentBundle(BASE_BUNDLE);
    // 加入新字段的 "preset" 但不传入 hashJudgmentBundle（新字段非 bundle 成员）
    const h2 = hashJudgmentBundle({ ...BASE_BUNDLE });
    expect(h1).toBe(h2);
  });
});

describe('PR0-2 · 新地图字段默认 undefined · 地图节点解析正常', () => {
  it('地点节点：新四字段解析均为 undefined', () => {
    const m = 地图Schema.parse({ 地点: { 空节点: {} } });
    const loc = m.地点['空节点'];
    expect((loc as any).区域映射).toBeUndefined();
    expect((loc as any).区域人口).toBeUndefined();
    expect((loc as any).人口密度).toBeUndefined();
    expect((loc as any).区域资源紧张度).toBeUndefined();
  });

  it('地图节点带新字段值 → 正确解析', () => {
    const m = 地图Schema.parse({
      地点: {
        区域_京畿道: {
          名称: '京畿道',
          类别: '区域级',
          区域映射: '华北大区',
          区域人口: 500000,
          人口密度: 120.5,
          区域资源紧张度: 35,
        },
      },
    });
    const loc = m.地点['区域_京畿道'];
    expect((loc as any).区域映射).toBe('华北大区');
    expect((loc as any).区域人口).toBe(500000);
    expect((loc as any).人口密度).toBe(120.5);
    expect((loc as any).区域资源紧张度).toBe(35);
  });
});

describe('PR0-3 · 全局._factFragment种子库 留位', () => {
  it('全局 Schema 解析：_factFragment种子库 默认 undefined', () => {
    const g = 全局Schema.parse({});
    expect((g as any)._factFragment种子库).toBeUndefined();
  });

  it('factFragment 种子条目：访问阈值 default=0·有锚布尔 default=true', () => {
    const g = 全局Schema.parse({
      _factFragment种子库: {
        'test:关系:001': {
          主体: 'NPC_王掌柜',
          维度: '关系',
          Δ方向: -1,
          量级: 60,
          // 访问阈值·有锚布尔 均走 default
        },
      },
    });
    const seed = (g as any)._factFragment种子库['test:关系:001'];
    expect(seed.访问阈值).toBe(0);
    expect(seed.有锚布尔).toBe(true);
    expect(seed.粗节点引用).toBeUndefined();
    expect(seed.来源世界域).toBeUndefined();
  });

  it('无锚 factFragment（造谣）：有锚布尔 = false 合法', () => {
    const g = 全局Schema.parse({
      _factFragment种子库: {
        'fake:声誉:007': {
          主体: 'NPC_李商人',
          维度: '声誉',
          Δ方向: -1,
          量级: 80,
          有锚布尔: false,
          narrativeFrame: '谣言：李商人欺诈顾客',
        },
      },
    });
    const seed = (g as any)._factFragment种子库['fake:声誉:007'];
    expect(seed.有锚布尔).toBe(false);
    expect(seed.narrativeFrame).toBe('谣言：李商人欺诈顾客');
  });
});

describe('PR0-4 · manifest=85 / schemaKeys=52 守恒', () => {
  it('BUNDLE_MEMBERS = 20', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(20);
  });

  it('PRESET_FIELDS = 11', () => {
    expect(FINGERPRINT_PRESET_FIELDS.length).toBe(11);
  });

  it('SNAPSHOT_FIELDS = 5', () => {
    expect(FINGERPRINT_SNAPSHOT_FIELDS.length).toBe(5);
  });

  it('EXCLUDED_FIELDS = 49（C2-6 新字段不进 EXCL）', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS.length).toBe(49);
  });

  it('manifest total = 85', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(85);
  });

  it('schemaKeys = 52（无新顶层键）', () => {
    expect(BLUEPRINT_KEYS.length).toBe(52);
    expect(Object.keys(RootSchema.shape).length).toBe(52);
  });
});

describe('PR0-5 · 双宿主快照恒等（C2-6 新字段全空跑）', () => {
  it('RootSchema 默认解析：canonicalize 两次输出逐位恒等', () => {
    const state = RootSchema.parse({});
    const c1 = canonicalize(state);
    const c2 = canonicalize(state);
    expect(c1).toBe(c2);
  });

  it('含新字段的 全局 状态：canonicalize 输出稳定', () => {
    const state = RootSchema.parse({
      全局: {
        _factFragment种子库: {
          'seed:001': { 主体: 'A', 维度: '关系', Δ方向: 1, 量级: 50 },
        },
      },
      地图: {
        地点: {
          区域_京畿: {
            名称: '京畿道',
            类别: '区域级',
            区域人口: 100000,
            区域资源紧张度: 40,
          },
        },
      },
    });
    const c1 = canonicalize(state);
    const c2 = canonicalize(state);
    expect(c1).toBe(c2);
  });
});

describe('PR0-6 · 新预设字段写值后解析正确', () => {
  it('预设带父预设/派生标记 → 解析后值正确', () => {
    const p = 玩法预设Schema.parse({
      预设ID: 'derived-001',
      父预设: 'base-preset',
      创建时预设版本: '2.0.0',
      派生标记: true,
      默认模板: false,
      经济生成规则: { 通货膨胀率: 0.03, 基础利率: 0.05 },
      社会熵默认值: 0.3,
    });
    expect(p.父预设).toBe('base-preset');
    expect(p.创建时预设版本).toBe('2.0.0');
    expect(p.派生标记).toBe(true);
    expect(p.默认模板).toBe(false);
    expect((p.经济生成规则 as any)?.通货膨胀率).toBe(0.03);
    expect(p.社会熵默认值).toBe(0.3);
  });

  it('社会熵默认值边界：0 和 1 合法', () => {
    expect(玩法预设Schema.parse({ 社会熵默认值: 0 }).社会熵默认值).toBe(0);
    expect(玩法预设Schema.parse({ 社会熵默认值: 1 }).社会熵默认值).toBe(1);
    expect(玩法预设Schema.safeParse({ 社会熵默认值: -0.1 }).success).toBe(false);
    expect(玩法预设Schema.safeParse({ 社会熵默认值: 1.1 }).success).toBe(false);
  });
});
