// C2-5 · 感知消费收尾：情绪栈回写 + _编年史 入册 专项回归
//
// DoD:
//   FA-1 关系维度 factFragment → 目击者情绪栈动（维度/Δ方向派生·信任感/警惕）
//   FA-2 死亡（生命维度）factFragment → 目击者情绪栈动（悲恸）
//   FA-3 情绪栈追加后 schema 合法（schemaKeys 不变·additive）
//   FA-4 公共事件（量级≥50·一手观测）→ _编年史 入册（序号单调递增）
//   FA-5 covert 事件（可见性=隐秘）→ 不入公共编年史（知情门天然生效）
//   FA-6 assemblePrompt 读编年史最近 5 条（systemPrompt 含 [序N] 标记）
//   FA-7 守恒 / 50 拍 schema 合法（additive 不破 schemaKeys）
//   FA-8 SETTLEMENT_PHASES 计数 = 14（感知情绪化 + 编年史入册 新增）

import { describe, it, expect } from 'vitest';
import { runTick, SETTLEMENT_PHASES } from '@ai-life-sim/core/engine/tick';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { RootSchema } from '@ai-life-sim/core';
import { 指令信封Schema } from '@ai-life-sim/core';
import { assemblePrompt } from '../assemble.js';
import {
  buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME, EXPECTED_NET_ASSET,
} from '../fixture/world.js';

const BASE_ENVELOPE = 指令信封Schema.parse({ 提案: {} });

function deathPack(actorKey: string) {
  return [[{ path: `NPC.${actorKey}.存活状态`, op: 'set' as const, value: '已故' }]];
}

// ── FA-1 · 关系维度 → 目击者情绪栈动 ─────────────────────────────────────────

describe('C2-5 FA-1 · 关系维度 factFragment → 情绪栈回写', () => {
  it('关系涟漪（Δ方向=-1·量级100）→ 在场 actor 情绪栈含「警惕」', () => {
    const s0 = buildWorld();
    s0.$涟漪候选[PC] = [{
      标签: '威胁', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa1-rel-neg', spanMinutes: 1440 });
    // NPC_WANG 在场（一手观测） → 情绪栈含「警惕」
    const 警惕 = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '警惕');
    expect(警惕).toBeDefined();
    expect(警惕?.数值).toBeGreaterThan(0);
    expect(警惕?.极性).toBe('负');
  });

  it('关系涟漪（Δ方向=+1·量级100）→ 在场 actor 情绪栈含「信任感」', () => {
    const s0 = buildWorld();
    s0.$涟漪候选[PC] = [{
      标签: '义举', 极性: '正', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: 1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa1-rel-pos', spanMinutes: 1440 });
    const 信任感 = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '信任感');
    expect(信任感).toBeDefined();
    expect(信任感?.数值).toBeGreaterThan(0);
    expect(信任感?.极性).toBe('正');
  });

  it('情绪强度取 max（同情绪名多次感知·不重复堆叠）', () => {
    const s0 = buildWorld();
    // 预填 NPC_WANG 情绪栈已有「警惕」数值=10
    s0.NPC[NPC_WANG]!.情绪栈 = [{
      情绪名: '警惕', 极性: '负', 数值: 10, 影响: [], 到期: 0, 来源: 'pre', 可叠加: false,
    }];
    s0.$涟漪候选[PC] = [{
      标签: '威胁', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa1-takemax', spanMinutes: 1440 });
    const 警惕Entries = s1.NPC[NPC_WANG]?.情绪栈.filter(e => e.情绪名 === '警惕') ?? [];
    expect(警惕Entries.length).toBe(1); // 不重复追加
    expect(警惕Entries[0]!.数值).toBeGreaterThan(10); // 取 max（新>旧）
  });
});

// ── FA-2 · 死亡（生命维度）→ 目击者情绪栈动 ────────────────────────────────────

describe('C2-5 FA-2 · 生命维度（死亡）→ 情绪栈回写', () => {
  it('NPC_WANG 死亡 → NPC_HONG 情绪栈含「悲恸」（负·量级=100）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'fa2-death-hong',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    const 悲恸 = s1.NPC[NPC_HONG]?.情绪栈.find(e => e.情绪名 === '悲恸');
    expect(悲恸).toBeDefined();
    expect(悲恸?.数值).toBeGreaterThan(0);
    expect(悲恸?.极性).toBe('负');
  });

  it('PC 死亡 → NPC_WANG 情绪栈含「悲恸」', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'fa2-pc-death',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(PC),
      injected授权源: '系统',
    });
    const 悲恸 = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '悲恸');
    expect(悲恸).toBeDefined();
  });

  it('死者自身情绪栈不写（死者停中继·无一手观测）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'fa2-no-self-emotion',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    // NPC_WANG 是死者·不是 obs1·无新印象 → 情绪栈不含「悲恸」
    const wangEmotions = s1.NPC[NPC_WANG]?.情绪栈 ?? [];
    const 悲恸 = wangEmotions.find(e => e.情绪名 === '悲恸');
    expect(悲恸).toBeUndefined();
  });
});

// ── FA-3 · schema 合法 ──────────────────────────────────────────────────────────

describe('C2-5 FA-3 · 情绪栈回写后 schema 合法', () => {
  it('死亡事件后 RootSchema.safeParse 通过', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'fa3-schema',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    const result = RootSchema.safeParse(s1);
    expect(result.success).toBe(true);
  });

  it('关系涟漪后 RootSchema.safeParse 通过', () => {
    const s0 = buildWorld();
    s0.$涟漪候选[PC] = [{
      标签: '冲突', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa3-schema-rel', spanMinutes: 1440 });
    expect(RootSchema.safeParse(s1).success).toBe(true);
  });
});

// ── FA-4 · 公共事件入 _编年史 ───────────────────────────────────────────────────

describe('C2-5 FA-4 · 公共事件（量级≥50·一手观测）→ _编年史入册', () => {
  it('NPC_WANG 死亡（量级100）→ _编年史 新增条目·包含 NPC_WANG 信息', () => {
    const s0 = buildWorld();
    const prevLen = s0.全局._编年史.length;
    const { state: s1 } = runTick(s0, {
      tickId: 'fa4-chronicle-death',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    expect(s1.全局._编年史.length).toBeGreaterThan(prevLen);
    const newEntry = s1.全局._编年史.at(-1);
    expect(newEntry?.序号).toBeGreaterThan(0);
    expect(newEntry?.标题).toContain(NPC_WANG);
    expect(newEntry?.时间).toBe(s0.世界?.纪元分钟 ?? 0);
  });

  it('高量级关系涟漪（量级100）→ _编年史 新增条目', () => {
    const s0 = buildWorld();
    const prevLen = s0.全局._编年史.length;
    s0.$涟漪候选[PC] = [{
      标签: '义举', 极性: '正', 强度: 100, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: 1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa4-chronicle-rel', spanMinutes: 1440 });
    expect(s1.全局._编年史.length).toBeGreaterThan(prevLen);
    const newEntry = s1.全局._编年史.at(-1);
    expect(newEntry?.标题).toContain(PC);
  });

  it('序号单调递增（M3_FORWARD_ONLY 守卫）', () => {
    const s0 = buildWorld();
    // Tick 1: WANG 死亡 → 编年史条目1
    const { state: s1 } = runTick(s0, {
      tickId: 'fa4-seq-tick1',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    // Tick 2: 手注高量级关系涟漪 → 编年史条目2
    s1.$涟漪候选[PC] = [{
      标签: '决裂', 极性: '负', 强度: 100, 可见性: '公开', 来源拍号: 1,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_HONG, 量级: 100 },
    }];
    const { state: s2 } = runTick(s1, { tickId: 'fa4-seq-tick2', spanMinutes: 1440 });
    const chronicle = s2.全局._编年史;
    expect(chronicle.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < chronicle.length; i++) {
      expect(chronicle[i]!.序号).toBeGreaterThan(chronicle[i - 1]!.序号);
    }
  });

  it('低量级事件（量级=10 < 50）→ 不入编年史', () => {
    const s0 = buildWorld();
    const prevLen = s0.全局._编年史.length;
    s0.$涟漪候选[PC] = [{
      标签: '小摩擦', 极性: '负', 强度: 10, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 10 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa4-low-mag', spanMinutes: 1440 });
    expect(s1.全局._编年史.length).toBe(prevLen);
  });
});

// ── FA-5 · covert 事件不入公共编年史 ──────────────────────────────────────────

describe('C2-5 FA-5 · covert 事件（可见性=隐秘）→ 不入公共编年史', () => {
  it('隐秘高量级涟漪 → propagateRipple 过滤 → _编年史 不增条目', () => {
    const s0 = buildWorld();
    const prevLen = s0.全局._编年史.length;
    s0.$涟漪候选[PC] = [{
      标签: '密谋', 极性: '负', 强度: 100, 可见性: '隐秘', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa5-covert', spanMinutes: 1440 });
    // covert → propagateRipple 跳过 → 无一手观测印象 → 不入编年史（知情门生效）
    expect(s1.全局._编年史.length).toBe(prevLen);
  });

  it('隐秘事件 actor 情绪栈也不动（无印象可消费）', () => {
    const s0 = buildWorld();
    const preWangEmotionCount = s0.NPC[NPC_WANG]?.情绪栈.length ?? 0;
    s0.$涟漪候选[PC] = [{
      标签: '密谋', 极性: '负', 强度: 100, 可见性: '隐秘', 来源拍号: 0,
      factFragment: { 主体: PC, 维度: '关系', Δ方向: -1, 客体: NPC_WANG, 量级: 100 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'fa5-covert-emotion', spanMinutes: 1440 });
    expect(s1.NPC[NPC_WANG]?.情绪栈.length ?? 0).toBe(preWangEmotionCount);
  });
});

// ── FA-6 · assemblePrompt 读编年史 ──────────────────────────────────────────────

describe('C2-5 FA-6 · assemblePrompt 读编年史最近 5 条', () => {
  it('死亡后编年史条目在 systemPrompt 中可见（「近期编年史」段落·[序N] 标记）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'fa6-assemble',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    expect(s1.全局._编年史.length).toBeGreaterThan(0);
    const { systemPrompt } = assemblePrompt(s1, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).toContain('近期编年史');
    const entry = s1.全局._编年史.at(-1);
    if (entry) {
      expect(systemPrompt).toContain(`[序${entry.序号}]`);
    }
  });

  it('5条以上编年史·assemblePrompt 只取最近5条', () => {
    const s0 = buildWorld();
    // 手填 6 条编年史（序号 1-6）
    s0.全局._编年史 = Array.from({ length: 6 }, (_, i) => ({
      序号: i + 1,
      时间: i * 100,
      标题: `事件${i + 1}`,
      结果摘要行: `摘要${i + 1}`,
      关联实体键: [],
      重要等级: '重要',
    }));
    const { systemPrompt } = assemblePrompt(s0, { pcKey: PC, locName: LOC_NAME });
    // 只有最近 5 条（序2~6）出现；序1 不出现
    expect(systemPrompt).toContain('[序6]');
    expect(systemPrompt).toContain('[序2]');
    expect(systemPrompt).not.toContain('[序1]');
  });
});

// ── FA-7 · 守恒 / schema ─────────────────────────────────────────────────────

describe('C2-5 FA-7 · 守恒 / schema 合法（additive 不破 schemaKeys）', () => {
  it('死亡拍后货币守恒不破', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId: 'fa7-conservation',
      injectedEnvelope: BASE_ENVELOPE,
      injectedPacks: deathPack(NPC_WANG),
      injected授权源: '系统',
    });
    expect(() =>
      assertConservation(s1.货币系统!.账户!, EXPECTED_NET_ASSET, getNetAsset),
    ).not.toThrow();
  });

  it('50 拍后 schema 仍合法', () => {
    let s = buildWorld();
    for (let i = 0; i < 50; i++) {
      ({ state: s } = runTick(s, { tickId: `fa7-50t-${i}`, spanMinutes: 1440 }));
    }
    expect(RootSchema.safeParse(s).success).toBe(true);
  });

  it('50 拍后 $涟漪候选 始终清空（守恒不退化）', () => {
    let s = buildWorld();
    for (let i = 0; i < 50; i++) {
      ({ state: s } = runTick(s, { tickId: `fa7-50t-rip-${i}`, spanMinutes: 1440 }));
    }
    expect(Object.keys(s.$涟漪候选 ?? {}).length).toBe(0);
  });
});

// ── FA-8 · SETTLEMENT_PHASES 计数 ──────────────────────────────────────────────

describe('C2-5 FA-8 · SETTLEMENT_PHASES 计数 = 17', () => {
  it('SETTLEMENT_PHASES 含 17 个阶段（感知情绪化 + 编年史入册 + B2 LOD调度 + P8-a 成就解锁 + P9-2 扩展参数播种 新增）', () => {
    expect(SETTLEMENT_PHASES).toHaveLength(17);
    expect(SETTLEMENT_PHASES).toContain('感知情绪化');
    expect(SETTLEMENT_PHASES).toContain('编年史入册');
  });

  it('单拍结算全部 17 个阶段', () => {
    const { settledPhases } = runTick(buildWorld(), { tickId: 'fa8-phases' });
    expect(settledPhases).toHaveLength(17);
    expect(settledPhases.at(-1)).toBe('原子提交');
  });
});
