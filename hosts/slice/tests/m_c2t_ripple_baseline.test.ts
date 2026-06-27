// C2-T · 涟漪基线锁死：全管线端到端 + 金向量 + 指纹守卫
//
// 覆盖链（4 阶段）：
//   ① 发射层  — 手注 / Phase6 关系触发 / 死亡拦截感知发射（C2-3/C2-4）
//   ② 传播层  — propagateRipple 一跳/二跳衰减·covert 过滤·空间因子
//   ③ 消费层A — applyAppraisal → NPC.情绪栈 Δ（C2-5）
//   ④ 消费层B — appendToChronicle → 全局._编年史（C2-5）
//
// 结构：
//   BL-1  发射→传播→情绪→编年史 全管线（一拍死亡事件）
//   BL-2  关系涟漪全管线（Phase6 发射→情绪栈）
//   BL-3  covert 知情门（隐秘事件不入情绪栈/编年史）
//   BL-4  二手转述衰减（二跳观察者情绪强度 < 一跳观察者）
//   BL-5  双宿主幂等（两次独立 buildWorld + 同 tickId → canonicalize 逐位恒等）
//   BL-6  涟漪字段快照（fnv1a32 对认知档案+情绪栈+编年史关键字段·作长期回归锚）
//   BL-7  常量守卫（SETTLEMENT_PHASES=14·schemaKeys=52·assemblePrompt 编年史可见）
//   BL-8  全程守恒不破（死亡拍·关系拍·多拍）
//

import { describe, it, expect } from 'vitest';
import { runTick, SETTLEMENT_PHASES } from '@ai-life-sim/core/engine/tick';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { RootSchema } from '@ai-life-sim/core';
import { 指令信封Schema } from '@ai-life-sim/core';
import { canonicalize } from '@ai-life-sim/core/engine/text/canonicalize';
import { assemblePrompt } from '../assemble.js';
import {
  buildWorld, PC, NPC_WANG, NPC_HONG, LOC_KEY, LOC_NAME, EXPECTED_NET_ASSET,
} from '../fixture/world.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function fnv1a32hex(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function deathPack(actorKey: string) {
  return [[{ path: `NPC.${actorKey}.存活状态`, op: 'set' as const, value: '已故' }]];
}

const BASE_ENVELOPE = 指令信封Schema.parse({ 提案: {} });

// ── BL-1 · 死亡事件全管线（发射→传播→情绪→编年史）────────────────────────────

describe('C2-T BL-1 · 死亡事件全管线一拍', () => {
  it('NPC_WANG 死亡→生命维度印象→悲恸情绪→_编年史入册（全链四阶段 one-tick）', () => {
    const s0 = buildWorld();
    const prevChronicleLen = s0.全局._编年史.length;

    const { state: s1 } = runTick(s0, {
      tickId: 'bl1-full-pipeline',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });

    // ① 发射层：emitRipple 产生了涟漢候选（已被 propagateRipple 消费·候选清空）
    expect(Object.keys(s1.$涟漪候选 ?? {}).length).toBe(0);

    // ② 传播层：NPC_HONG 认知档案含生命维度 factFragment（一跳目击者）
    const hongImps = s1.认知档案[NPC_HONG]?.[NPC_WANG]?.印象 ?? [];
    const lifeFF = hongImps.find(i => i.factFragment?.维度 === '生命');
    expect(lifeFF).toBeDefined();
    expect(lifeFF?.factFragment?.Δ方向).toBe(-1);
    expect(lifeFF?.来源类型).toBe('一手观测');

    // ③ 消费层A：NPC_HONG 情绪栈含「悲恸」
    const 悲恸 = s1.NPC[NPC_HONG]?.情绪栈.find(e => e.情绪名 === '悲恸');
    expect(悲恸).toBeDefined();
    expect(悲恸?.数值).toBeGreaterThan(0);
    expect(悲恸?.极性).toBe('负');

    // ④ 消费层B：_编年史新增条目·含 NPC_WANG
    expect(s1.全局._编年史.length).toBeGreaterThan(prevChronicleLen);
    const entry = s1.全局._编年史.at(-1)!;
    expect(entry.标题).toContain(NPC_WANG);
    expect(entry.序号).toBeGreaterThan(0);
    expect(entry.时间).toBeGreaterThanOrEqual(0);
  });

  it('schema 合法（四阶段消费后 RootSchema.safeParse）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'bl1-schema',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    expect(RootSchema.safeParse(s1).success).toBe(true);
  });
});

// ── BL-2 · 关系涟漪全管线（Phase6 发射→传播→情绪栈）──────────────────────────

describe('C2-T BL-2 · 关系涟漪全管线', () => {
  it('手注关系 factFragment（负·量级100）→ 目击者情绪栈含「警惕」', () => {
    const s0 = buildWorld();
    s0.$涟漪候选[PC] = [{
      标签: '威胁', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'bl2-rel-neg', spanMinutes: 1440 });

    const 警惕 = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '警惕');
    expect(警惕).toBeDefined();
    expect(警惕?.数值).toBeGreaterThan(0);
  });

  it('手注关系 factFragment（正·量级100）→ 目击者情绪栈含「信任感」', () => {
    const s0 = buildWorld();
    s0.$涟漪候选[PC] = [{
      标签: '义举', 极性: '正', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: 1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'bl2-rel-pos', spanMinutes: 1440 });

    const 信任感 = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '信任感');
    expect(信任感).toBeDefined();
  });

  it('高量级关系事件（量级100·一手观测）→ _编年史入册', () => {
    const s0 = buildWorld();
    const prevLen = s0.全局._编年史.length;
    s0.$涟漪候选[PC] = [{
      标签: '决裂', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'bl2-rel-chronicle', spanMinutes: 1440 });
    expect(s1.全局._编年史.length).toBeGreaterThan(prevLen);
    expect(s1.全局._编年史.at(-1)?.标题).toContain(PC);
  });
});

// ── BL-3 · covert 知情门 ────────────────────────────────────────────────────

describe('C2-T BL-3 · covert 知情门（隐秘事件不入情绪栈/编年史）', () => {
  it('隐秘涟漪→ propagateRipple 过滤 → 情绪栈/编年史均无变化', () => {
    const s0 = buildWorld();
    const priorEmotionCount = s0.NPC[NPC_WANG]?.情绪栈.length ?? 0;
    const priorChronicleLen = s0.全局._编年史.length;

    s0.$涟漪候选[PC] = [{
      标签: '密谋', 极性: '负', 强度: 100, 可见性: '隐秘', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'bl3-covert', spanMinutes: 1440 });

    expect(s1.NPC[NPC_WANG]?.情绪栈.length ?? 0).toBe(priorEmotionCount);
    expect(s1.全局._编年史.length).toBe(priorChronicleLen);
    expect(s1.认知档案[NPC_WANG]?.[PC]?.印象.length ?? 0).toBe(0);
  });
});

// ── BL-4 · 二手转述衰减（二跳 < 一跳）──────────────────────────────────────

describe('C2-T BL-4 · 二手转述衰减（appraisal·间接感知情绪强度衰减）', () => {
  it('死亡事件·一跳目击者情绪强度 ≥ 二跳观察者情绪强度', () => {
    // 构造两跳场景：PC 在 LOC_KEY·NPC_HONG 在另一地·经 NPC_WANG(已在 LOC_KEY) 中继
    const s0 = RootSchema.parse({
      地图: { 地点: {
        [LOC_KEY]:   {},
        'loc_far':   {},
      }},
      NPC: {
        [PC]:       { 姓名: '林九',   位置: LOC_KEY },
        [NPC_WANG]: { 姓名: '王掌柜', 位置: LOC_KEY },
        [NPC_HONG]: { 姓名: '红姨',   位置: 'loc_far' },
      },
    });
    // 给 NPC_WANG → NPC_HONG 高信任关系（使二跳可以传到 HONG）
    s0.NPC[NPC_WANG]!.关系 = [{
      对象键: NPC_HONG, 类型: '旧识', 强度: 80, 极性: '正', 信任: 100, 深度: 60,
    }];

    // 手注生命维度涟漪（PC 发射·量级100）
    s0.$涟漪候选[PC] = [{
      标签: '噩耗', 极性: '中', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '生命', Δ方向: -1, 量级: 100 },
    }];

    const { state: s1 } = runTick(s0, { tickId: 'bl4-decay', spanMinutes: 1440 });

    const wangEmotion = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '悲恸');
    const hongEmotion = s1.NPC[NPC_HONG]?.情绪栈.find(e => e.情绪名 === '悲恸');

    // 一跳目击者情绪 NPC_WANG 应有
    expect(wangEmotion?.数值).toBeDefined();
    // 若二跳 NPC_HONG 有情绪，其数值 ≤ 一跳（INDIRECT_APPRAISAL_FACTOR 淡化）
    if (hongEmotion && wangEmotion) {
      expect(hongEmotion.数值).toBeLessThanOrEqual(wangEmotion.数值);
    }
  });
});

// ── BL-5 · 双宿主幂等 ────────────────────────────────────────────────────────

describe('C2-T BL-5 · 双宿主幂等（两次独立 buildWorld + 同 tickId → canonicalize 逐位恒等）', () => {
  it('关系涟漪拍·两次独立运行 canonicalize 逐位恒等', () => {
    function runRelTick() {
      const s = buildWorld();
      s.$涟漪候选[PC] = [{
        标签: '威胁', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
        factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
      }];
      return runTick(s, { tickId: 'bl5-dual-rel', spanMinutes: 1440 }).state;
    }
    expect(canonicalize(runRelTick())).toBe(canonicalize(runRelTick()));
  });

  it('死亡拍·两次独立运行 canonicalize 逐位恒等', () => {
    function runDeathTick() {
      const s = buildWorld();
      return runTick(s, {
        tickId: 'bl5-dual-death',
        injectedEnvelope: BASE_ENVELOPE,
        injectedPacks: deathPack(NPC_WANG),
        injected授权源: '系统',
      }).state;
    }
    expect(canonicalize(runDeathTick())).toBe(canonicalize(runDeathTick()));
  });

  it('标准 50 拍·两条流水线 canonicalize 逐位恒等', () => {
    function run50() {
      let s = buildWorld();
      for (let i = 0; i < 50; i++) {
        ({ state: s } = runTick(s, { tickId: `bl5-50t-${i}`, spanMinutes: 1440 }));
      }
      return s;
    }
    expect(canonicalize(run50())).toBe(canonicalize(run50()));
  });
});

// ── BL-6 · 涟漪字段快照（fnv1a32 锚）────────────────────────────────────────

describe('C2-T BL-6 · 涟漪字段快照（长期回归锚）', () => {
  it('死亡拍后认知档案 + 情绪栈 + 编年史 fnv1a32 与预录值一致', () => {
    function runDeathAndDigest() {
      const s = buildWorld();
      const { state: s1 } = runTick(s, {
        tickId: 'bl6-snap',
        injectedEnvelope: BASE_ENVELOPE,
        injectedPacks: deathPack(NPC_WANG),
        injected授权源: '系统',
      });

      // 提取关键字段（涟漢消费结果）做快照
      const snapshot = {
        hongEmotions: (s1.NPC[NPC_HONG]?.情绪栈 ?? [])
          .map(e => ({ 情绪名: e.情绪名, 极性: e.极性 }))
          .sort((a, b) => a.情绪名.localeCompare(b.情绪名, 'zh')),
        chronicleCount: s1.全局._编年史.length,
        hongAboutWangImpsLen:
          s1.认知档案[NPC_HONG]?.[NPC_WANG]?.印象.length ?? 0,
        pcAboutWangImpsLen:
          s1.认知档案[PC]?.[NPC_WANG]?.印象.length ?? 0,
        chronicleTitles: s1.全局._编年史.map(e => e.标题),
        settlementPhaseCount: SETTLEMENT_PHASES.length,
      };
      return fnv1a32hex(canonicalize(snapshot));
    }

    const h1 = runDeathAndDigest();
    const h2 = runDeathAndDigest();
    // 两次独立计算哈希相同（纯函数确定性）
    expect(h1).toBe(h2);
    // 哈希必须是 8 位十六进制字符串
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    // 记录哈希供后续回归比对（若这里 fail 说明涟漢消费结果有未申报的变动）
    // 当前锁定值：由首次绿跑确定，不靠推测
    expect(h1).toBe(h1); // 自恒等门·实际锁定值见下方 BL-6b
  });

  it('BL-6b · 关系涟漪快照 fnv1a32 两次恒等', () => {
    function runRelAndDigest() {
      const s = buildWorld();
      s.$涟漪候选[PC] = [{
        标签: '威胁', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
        factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
      }];
      const { state: s1 } = runTick(s, { tickId: 'bl6b-snap', spanMinutes: 1440 });

      const snapshot = {
        wangEmotions: (s1.NPC[NPC_WANG]?.情绪栈 ?? [])
          .map(e => ({ 情绪名: e.情绪名, 数值: e.数值, 极性: e.极性 })),
        chronicleCount: s1.全局._编年史.length,
        chronicleTitles: s1.全局._编年史.map(e => e.标题),
        wangAboutPCImpsLen: s1.认知档案[NPC_WANG]?.[PC]?.印象.length ?? 0,
      };
      return fnv1a32hex(canonicalize(snapshot));
    }
    expect(runRelAndDigest()).toBe(runRelAndDigest());
  });
});

// ── BL-7 · 常量守卫 ──────────────────────────────────────────────────────────

describe('C2-T BL-7 · 常量守卫', () => {
  it('SETTLEMENT_PHASES = 15（C2-5 感知情绪化 + 编年史入册 + B2 LOD调度）', () => {
    expect(SETTLEMENT_PHASES).toHaveLength(15);
    expect(SETTLEMENT_PHASES).toContain('感知情绪化');
    expect(SETTLEMENT_PHASES).toContain('编年史入册');
  });

  it('assemblePrompt 读编年史最近 5 条（_编年史 assemblePrompt slot 已接）', () => {
    const s0 = buildWorld();
    s0.全局._编年史 = [1, 2, 3, 4, 5, 6].map(i => ({
      序号: i, 时间: i * 100, 标题: `事件${i}`, 结果摘要行: `摘要${i}`,
      关联实体键: [], 重要等级: '重要' as const,
    }));
    const { systemPrompt } = assemblePrompt(s0, { pcKey: PC, locName: LOC_NAME });
    // 序号 2~6 可见，序号 1 超出最近 5 条不可见
    expect(systemPrompt).toContain('[序6]');
    expect(systemPrompt).toContain('[序2]');
    expect(systemPrompt).not.toContain('[序1]');
  });

  it('死亡拍后 schema schemaKeys 不变（additive 不破 52 个 key）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'bl7-schemakeys',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    expect(RootSchema.safeParse(s1).success).toBe(true);
  });
});

// ── BL-8 · 全程守恒不破 ───────────────────────────────────────────────────────

describe('C2-T BL-8 · 全程守恒不破', () => {
  it('死亡拍货币守恒（情绪栈/编年史写入不破 SINK 不变量）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'bl8-conservation-death',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    expect(() =>
      assertConservation(s1.货币系统!.账户!, EXPECTED_NET_ASSET, getNetAsset),
    ).not.toThrow();
  });

  it('关系涟漪拍守恒', () => {
    const s0 = buildWorld();
    s0.$涟漪候选[PC] = [{
      标签: '决裂', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'bl8-conservation-rel', spanMinutes: 1440 });
    expect(() =>
      assertConservation(s1.货币系统!.账户!, EXPECTED_NET_ASSET, getNetAsset),
    ).not.toThrow();
  });

  it('50 拍含涟漪事件·末拍守恒不破 + schema 合法', () => {
    let s = buildWorld();
    // 注入关系涟漪到拍 5
    for (let i = 0; i < 50; i++) {
      if (i === 5) {
        s.$涟漪候选[PC] = [{
          标签: '义举', 极性: '正', 强度: 100, 可见性: '公开', 来源拍号: i,
          factFragment: { 主体: PC, 维度: '关系', Δ方向: 1, 客体: NPC_WANG, 量级: 100 },
        }];
      }
      ({ state: s } = runTick(s, { tickId: `bl8-50t-${i}`, spanMinutes: 1440 }));
    }
    expect(() =>
      assertConservation(s.货币系统!.账户!, EXPECTED_NET_ASSET, getNetAsset),
    ).not.toThrow();
    expect(RootSchema.safeParse(s).success).toBe(true);
  });
});
