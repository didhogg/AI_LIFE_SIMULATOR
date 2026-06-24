// C2-4 · 死亡拦截感知发射（生命维度）专项回归
//
// DoD:
//   FD-1 NPC 死亡 → 同地点目击者认知档案含 维度:'生命' Δ方向:-1 中立事件
//   FD-2 PC 死亡（全 actor 同路径）→ 目击者同样收到生命维度印象
//   FD-3 死者不自传中继（停中继·观察者是在场存活方，非死者自身）
//   FD-4 死讯守恒：$涟漪候选 经 propagateRipple 后清空（FF-3 口径）
//   FD-5 拍前已故 actor 不重复发射（跨拍防重复）
//   FD-6 死者防护 obs1 guard：已故 actor 不作为中继节点转发其他涟漪
import { describe, it, expect } from 'vitest';
import { runTick } from '@ai-life-sim/core/engine/tick';
import { RootSchema } from '@ai-life-sim/core';
import { 指令信封Schema } from '@ai-life-sim/core';
import { buildWorld, PC, NPC_WANG, NPC_HONG, LOC_KEY } from '../fixture/world.js';

// 最小合法注入信封（提案字段必填·子字段均有 default）
const DEATH_ENVELOPE = 指令信封Schema.parse({ 提案: {} });

// 通过 injectedPacks 在 tick 内将指定 actor 设为已故
function deathPack(actorKey: string) {
  return [[{ path: `NPC.${actorKey}.存活状态`, op: 'set' as const, value: '已故' }]];
}

// ── FD-1 · NPC 死亡 → 目击者认知档案含生命维度印象 ──────────────────────────────

describe('C2-4 FD-1 · NPC 死亡 → 同地点目击者收到生命维度印象', () => {
  it('NPC_WANG 死亡·NPC_HONG 在场 → HONG 认知档案含维度:生命 Δ方向:-1', () => {
    const s0 = buildWorld();
    // NPC_WANG 与 NPC_HONG 均在 LOC_KEY（buildWorld 默认）
    const { state: s1 } = runTick(s0, {
      tickId:          'fd1-npc-death',
      injectedEnvelope: DEATH_ENVELOPE,
      injectedPacks:   deathPack(NPC_WANG),
      injected授权源:  '系统',
    });
    const hongAboutWang = s1.认知档案[NPC_HONG]?.[NPC_WANG]?.印象 ?? [];
    expect(hongAboutWang.length).toBeGreaterThan(0);
    const ff = hongAboutWang[0]?.factFragment;
    expect(ff?.维度).toBe('生命');
    expect(ff?.Δ方向).toBe(-1);
    expect(ff?.主体).toBe(NPC_WANG);
    expect(hongAboutWang[0]?.极性).toBe('中'); // 中立事实性事件（非主观极性）
    expect(hongAboutWang[0]?.来源类型).toBe('一手观测'); // 在场直接目击
  });

  it('NPC_WANG 死亡·PC 在场 → PC 认知档案含同一载荷（全 actor 同路径）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId:          'fd1-pc-witness',
      injectedEnvelope: DEATH_ENVELOPE,
      injectedPacks:   deathPack(NPC_WANG),
      injected授权源:  '系统',
    });
    const pcAboutWang = s1.认知档案[PC]?.[NPC_WANG]?.印象 ?? [];
    expect(pcAboutWang.length).toBeGreaterThan(0);
    const ff = pcAboutWang[0]?.factFragment;
    expect(ff?.维度).toBe('生命');
    expect(ff?.Δ方向).toBe(-1);
  });
});

// ── FD-2 · PC 死亡 → 全 actor 同路径 ────────────────────────────────────────────

describe('C2-4 FD-2 · PC 死亡 → 目击者收到生命维度印象（PC 与 NPC 同路径）', () => {
  it('PC 死亡·NPC_WANG 在场 → WANG 收到关于 PC 的 维度:生命 印象', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId:          'fd2-pc-death',
      injectedEnvelope: DEATH_ENVELOPE,
      injectedPacks:   deathPack(PC),
      injected授权源:  '系统',
    });
    const wangAboutPC = s1.认知档案[NPC_WANG]?.[PC]?.印象 ?? [];
    expect(wangAboutPC.length).toBeGreaterThan(0);
    const ff = wangAboutPC[0]?.factFragment;
    expect(ff?.维度).toBe('生命');
    expect(ff?.Δ方向).toBe(-1);
    expect(ff?.主体).toBe(PC);
    expect(wangAboutPC[0]?.极性).toBe('中');
  });
});

// ── FD-3 · 死者不自传中继 ─────────────────────────────────────────────────────────

describe('C2-4 FD-3 · 死者不自传中继（死者不写入自身认知档案）', () => {
  it('NPC_WANG 死亡 → WANG 自身认知档案中不含关于自身死亡的印象', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId:          'fd3-no-self-relay',
      injectedEnvelope: DEATH_ENVELOPE,
      injectedPacks:   deathPack(NPC_WANG),
      injected授权源:  '系统',
    });
    // targetKey = NPC_WANG·presentKeys excludes targetKey → WANG 不是观察者
    const wangAboutWang = s1.认知档案[NPC_WANG]?.[NPC_WANG]?.印象 ?? [];
    expect(wangAboutWang.length).toBe(0);
  });
});

// ── FD-4 · 死讯守恒 ───────────────────────────────────────────────────────────────

describe('C2-4 FD-4 · 死讯守恒：$涟漪候选 处理后清空', () => {
  it('NPC_WANG 死亡后 propagateRipple 清空 $涟漪候选（FF-3 口径）', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId:          'fd4-conservation',
      injectedEnvelope: DEATH_ENVELOPE,
      injectedPacks:   deathPack(NPC_WANG),
      injected授权源:  '系统',
    });
    expect(Object.keys(s1.$涟漪候选 ?? {}).length).toBe(0);
  });
});

// ── FD-5 · 拍前已故 actor 不重复发射 ──────────────────────────────────────────────

describe('C2-4 FD-5 · 拍前已故 actor 不重复发射', () => {
  it('拍前即已故的 NPC → 第二拍不重新发射生命维度涟漪', () => {
    // 先跑一拍让 NPC_WANG 死亡
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, {
      tickId:          'fd5-death-tick',
      injectedEnvelope: DEATH_ENVELOPE,
      injectedPacks:   deathPack(NPC_WANG),
      injected授权源:  '系统',
    });
    // s1 中 NPC_WANG 已故；第二拍 priorDeadSet 含 NPC_WANG → 不重复发射
    const { state: s2 } = runTick(s1, { tickId: 'fd5-second-tick' });
    // NPC_HONG 第二拍不应新增关于 WANG 死亡的印象（衰减可能降强度·新增条目=重复发射的证据）
    // 验证：第二拍后 HONG 关于 WANG 的生命维度印象最多只有 1 条（与第一拍相同）
    const hongImps = s2.认知档案[NPC_HONG]?.[NPC_WANG]?.印象 ?? [];
    const lifeImps = hongImps.filter(i => i.factFragment?.维度 === '生命');
    expect(lifeImps.length).toBeLessThanOrEqual(1); // 最多 1 条（无重复追加）
  });
});

// ── FD-6 · 死者防护 obs1 guard ────────────────────────────────────────────────────

describe('C2-4 FD-6 · 死者防护 obs1 guard：已故 actor 不转发其他涟漪', () => {
  it('NPC_WANG 死亡后·手注给 WANG 的涟漪·WANG 不作 obs1 转发给 HONG', () => {
    // 构造场景：NPC_WANG 已故·NPC_HONG 在 other_loc（不在场·只能由 WANG 转发二跳）
    // WANG 有关系边到 HONG（autoCompleteRelations 仅对在场创建·此处手建）
    const s = RootSchema.parse({
      地图: { 地点: {
        [LOC_KEY]:    {},
        'loc_other':  {},
      }},
      NPC: {
        [PC]:       { 姓名: '林九',   位置: LOC_KEY },
        [NPC_WANG]: { 姓名: '王掌柜', 位置: LOC_KEY, 存活状态: '已故' },
        [NPC_HONG]: { 姓名: '红姨',   位置: 'loc_other' },
      },
    });
    // 给 WANG 手建到 HONG 的关系边（信任100·使其可作二跳中继）
    const wang = s.NPC[NPC_WANG];
    if (wang) {
      wang.关系 = [{ 对象键: NPC_HONG, 类型: '旧识', 强度: 80, 极性: '正', 信任: 100, 深度: 60 }];
    }
    // 手注一条关于 PC 的涟漪（目标=PC 在场·观察者=WANG 已故 → 停中继 → HONG 不收）
    s.$涟漪候选[PC] = [{
      标签: '壮举', 极性: '正', 强度: 90, 可见性: '公开', 来源拍号: 0,
    }];
    const { state: s1 } = runTick(s, { tickId: 'fd6-dead-relay' });
    // WANG 是 obs1 但已故 → guard 跳过·HONG 不收二跳印象
    const hongAboutPC = s1.认知档案[NPC_HONG]?.[PC]?.印象 ?? [];
    expect(hongAboutPC.length).toBe(0); // 死者停中继·HONG 零印象
  });
});
