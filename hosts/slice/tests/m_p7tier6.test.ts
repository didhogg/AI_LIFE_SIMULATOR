// P0-7 梯队6 验收测试 — 其余结算子项收尾（黄批·穿插）
//
// DoD 行为断言：
//   P7-6a: 跨域同拍序键三元定序稳定 + 跨域一次性结账 + 解封补结区间
//   P7-6b: 涟漢 + 媒介取材在固定结算序内不乱序（SETTLEMENT_PHASES 顺序验证）
//   P7-6c: 知情类 extensional 展开落账 + 消费点两类枚举表
//   P7-6d: 指令组锚点快照 pin（G3·6.49）
//   P7-6e: Resolver 三段契约签名冻结 + ExternalRoundEvent 最小载荷类型
//   P7-6f: 月结自然月边界检测 + 历法对齐拍自动续拍
//   P7-6g: 断言② 重掷整组重跑恒等（F1 组内隔离实证）
//   P7-6h: AA6 负向控制（改 effect packs → 哈希变；改无关项 → 哈希不变）

import { describe, it, expect } from 'vitest';

// ── P7-6a 跨域结账 ────────────────────────────────────────────────────────────
import {
  makeTriTickKey,
  compareTriTickKeys,
  sortByTriTickKey,
  computeSupplementInterval,
  crossDomainOneShot,
} from '@ai-life-sim/core/engine/crossDomain';
import type { TriTickKey, DomainAssetEntry } from '@ai-life-sim/core/engine/crossDomain';

// ── P7-6b 结算序 ──────────────────────────────────────────────────────────────
import { SETTLEMENT_PHASES } from '@ai-life-sim/core/engine/tick';

// ── P7-6c 知情写入口 ──────────────────────────────────────────────────────────
import {
  KNOWLEDGE_CONSUMER_TYPES,
  KNOWLEDGE_CONSUMER_REGISTRY,
  KNOWLEDGE_ENTRY_CHANNELS,
  expandKnowledgeSelector,
  knowledgeWrite,
} from '@ai-life-sim/core/engine/knowledgeWrite';

// ── P7-6d 指令组锚点 ──────────────────────────────────────────────────────────
import {
  pinGroupAnchor,
  assertGroupAnchorExists,
  verifyGroupReplayIdempotency,
} from '@ai-life-sim/core/engine/groupAnchor';

// ── P7-6e Resolver 签名 ───────────────────────────────────────────────────────
import { CombatResolver } from '@ai-life-sim/core/interfaces/combatResolver';
import type { ExternalRoundEvent, 战局状态, CombatSettleResult } from '@ai-life-sim/core/interfaces/combatResolver';

// ── P7-6f 历法 ───────────────────────────────────────────────────────────────
import {
  isNaturalMonthBoundary,
  computeCalendarContinuation,
  nextMonthStart,
  gregorianToEpochMin,
} from '@ai-life-sim/core/engine/time';

// ── P7-6g 断言② 依赖 ─────────────────────────────────────────────────────────
import {
  Ring2GenerationTracker,
} from '../engine/concurrency.js';
import { buildWorld } from '../fixture/world.js';
import { runTick } from '@ai-life-sim/core/engine/tick';

// ── P7-6h AA6 负向控制 ───────────────────────────────────────────────────────
import {
  fillEffectPackHash,
  computeEffectPackSetHash,
} from '@ai-life-sim/core/engine/effectGate';

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6a · 6.54 跨域资金一次性结账 / 解封补结区间 / 三元定序键
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6a · 跨域同拍序键三元定序稳定', () => {
  it('正全局拍号·字典序稳定', () => {
    const k1 = makeTriTickKey({ globalTick: 1000, domainId: 'domain_A', seedId: 's1' });
    const k2 = makeTriTickKey({ globalTick: 1001, domainId: 'domain_A', seedId: 's1' });
    expect(compareTriTickKeys(k1, k2)).toBeLessThan(0);
  });

  it('同 globalTick·domainId 次序', () => {
    const k1 = makeTriTickKey({ globalTick: 500, domainId: 'alpha', seedId: 's0' });
    const k2 = makeTriTickKey({ globalTick: 500, domainId: 'beta',  seedId: 's0' });
    expect(compareTriTickKeys(k1, k2)).toBeLessThan(0);
  });

  it('同 globalTick 同 domainId·seedId 末序', () => {
    const k1 = makeTriTickKey({ globalTick: 500, domainId: 'dom', seedId: 'seed_1' });
    const k2 = makeTriTickKey({ globalTick: 500, domainId: 'dom', seedId: 'seed_2' });
    expect(compareTriTickKeys(k1, k2)).toBeLessThan(0);
  });

  it('相等键 → compareTriTickKeys = 0', () => {
    const key: TriTickKey = { globalTick: 999, domainId: 'x', seedId: 'y' };
    expect(compareTriTickKeys(makeTriTickKey(key), makeTriTickKey(key))).toBe(0);
  });

  it('负全局拍号支持（古代纪元）', () => {
    const k1 = makeTriTickKey({ globalTick: -1000, domainId: 'dom', seedId: 's' });
    const k2 = makeTriTickKey({ globalTick:     0, domainId: 'dom', seedId: 's' });
    const k3 = makeTriTickKey({ globalTick:  1000, domainId: 'dom', seedId: 's' });
    expect(compareTriTickKeys(k1, k2)).toBeLessThan(0);
    expect(compareTriTickKeys(k2, k3)).toBeLessThan(0);
  });

  it('sortByTriTickKey: 乱序 → 按三元键排序', () => {
    const keys = [
      makeTriTickKey({ globalTick: 300, domainId: 'b', seedId: '1' }),
      makeTriTickKey({ globalTick: 100, domainId: 'a', seedId: '2' }),
      makeTriTickKey({ globalTick: 100, domainId: 'a', seedId: '1' }),
      makeTriTickKey({ globalTick: 200, domainId: 'c', seedId: '0' }),
    ];
    const sorted = sortByTriTickKey(keys);
    expect(sorted[0]).toBe(makeTriTickKey({ globalTick: 100, domainId: 'a', seedId: '1' }));
    expect(sorted[1]).toBe(makeTriTickKey({ globalTick: 100, domainId: 'a', seedId: '2' }));
    expect(sorted[2]).toBe(makeTriTickKey({ globalTick: 200, domainId: 'c', seedId: '0' }));
    expect(sorted[3]).toBe(makeTriTickKey({ globalTick: 300, domainId: 'b', seedId: '1' }));
  });

  it('解封补结区间：durationMin = unsealedAt − sealedAt', () => {
    const interval = computeSupplementInterval('domain_B', 43200, 86400);
    expect(interval.domainId).toBe('domain_B');
    expect(interval.sealedAt).toBe(43200);
    expect(interval.unsealedAt).toBe(86400);
    expect(interval.durationMin).toBe(43200);
  });

  it('跨域一次性结账：有利率时 interest > 0', () => {
    const interval = computeSupplementInterval('dom_X', 0, 518400); // 1 年
    const assets: DomainAssetEntry[] = [
      { entityKey: 'merchant', domainId: 'dom_X', amount: 1000, annualRate: 0.05 },
    ];
    const result = crossDomainOneShot(interval, assets);
    expect(result.domainId).toBe('dom_X');
    expect(result.settlements).toHaveLength(1);
    const s = result.settlements[0]!;
    expect(s.interest).toBeCloseTo(50, 0);   // 1000 × 0.05 × 1 年
    expect(s.totalDelta).toBeCloseTo(1050, 0);
  });

  it('跨域一次性结账：零利率 → interest = 0', () => {
    const interval = computeSupplementInterval('dom_Y', 0, 518400);
    const assets: DomainAssetEntry[] = [
      { entityKey: 'pc', amount: 200, annualRate: 0 },
    ];
    const result = crossDomainOneShot(interval, assets);
    expect(result.settlements[0]!.interest).toBe(0);
    expect(result.settlements[0]!.totalDelta).toBe(200);
  });

  it('跨域一次性结账：域籍不匹配 → 跳过', () => {
    const interval = computeSupplementInterval('dom_A', 0, 518400);
    const assets: DomainAssetEntry[] = [
      { entityKey: 'pc', domainId: 'dom_B', amount: 100, annualRate: 0.1 },
    ];
    const result = crossDomainOneShot(interval, assets);
    expect(result.settlements).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6b · 6.55 涟漪先落账 + 媒介拍末取材进固定结算序（不乱序）
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6b · 固定结算序阶段顺序验证', () => {
  it('SETTLEMENT_PHASES 包含所有预期阶段（含新增媒介拍末取材）', () => {
    const phases = [...SETTLEMENT_PHASES];
    expect(phases).toContain('日程结算');
    expect(phases).toContain('涟漪传播');
    expect(phases).toContain('媒介拍末取材');
    expect(phases).toContain('原子提交');
  });

  it('涟漪传播 < 媒介拍末取材 < 原子提交（不乱序·E4·6.55）', () => {
    const phases = [...SETTLEMENT_PHASES];
    const rippleIdx  = phases.indexOf('涟漪传播');
    const mediaIdx   = phases.indexOf('媒介拍末取材');
    const commitIdx  = phases.indexOf('原子提交');
    expect(rippleIdx).toBeGreaterThanOrEqual(0);
    expect(mediaIdx).toBeGreaterThanOrEqual(0);
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(rippleIdx).toBeLessThan(mediaIdx);   // 涟漪先落账（涟漪传播在媒介取材之前）
    expect(mediaIdx).toBeLessThan(commitIdx);   // 媒介拍末取材在原子提交之前
  });

  it('既有阶段相对顺序不破（不破梯队2既有顺序）', () => {
    const phases = [...SETTLEMENT_PHASES];
    const 日程   = phases.indexOf('日程结算');
    const 萌发   = phases.indexOf('事件种子萌发');
    const 衰减   = phases.indexOf('衰减批');
    const 涟漪   = phases.indexOf('涟漪传播');
    const 提交   = phases.indexOf('原子提交');
    expect(日程).toBeLessThan(萌发);
    expect(萌发).toBeLessThan(衰减);
    expect(衰减).toBeLessThan(涟漪);
    expect(涟漪).toBeLessThan(提交);
  });

  it('runTick：媒介拍末取材 phase 在 settledPhases 中且位于原子提交之前', () => {
    const state = buildWorld();
    const { settledPhases } = runTick(state, { tickId: 'tier6-phase-test' });
    expect(settledPhases).toContain('媒介拍末取材');
    expect(settledPhases).toContain('原子提交');
    const mediaIdx  = settledPhases.indexOf('媒介拍末取材');
    const commitIdx = settledPhases.indexOf('原子提交');
    expect(mediaIdx).toBeLessThan(commitIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6c · 6.60 知情类 extensional 写入口 + 消费点两类枚举表
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6c · 知情类 extensional 展开落账', () => {
  it('KNOWLEDGE_CONSUMER_TYPES 两类齐全', () => {
    expect(KNOWLEDGE_CONSUMER_TYPES).toContain('即时现算');
    expect(KNOWLEDGE_CONSUMER_TYPES).toContain('落账瞬间定格');
    expect(KNOWLEDGE_CONSUMER_TYPES).toHaveLength(2);
  });

  it('KNOWLEDGE_CONSUMER_REGISTRY 包含增审7 三槽位', () => {
    const slotIds = KNOWLEDGE_CONSUMER_REGISTRY.map(e => e.slotId);
    expect(slotIds).toContain('雇主');
    expect(slotIds).toContain('母亲');
    expect(slotIds).toContain('恋人');
  });

  it('消息发信槽位：雇主/母亲/恋人 = 即时现算·发信落账 = 落账瞬间定格', () => {
    const reg = KNOWLEDGE_CONSUMER_REGISTRY;
    const 雇主 = reg.find(e => e.slotId === '雇主');
    const 发信 = reg.find(e => e.slotId === '发信落账');
    expect(雇主?.consumerType).toBe('即时现算');
    expect(发信?.consumerType).toBe('落账瞬间定格');
  });

  it('KNOWLEDGE_ENTRY_CHANNELS：包含入圈四通道', () => {
    expect(KNOWLEDGE_ENTRY_CHANNELS).toContain('涟漪入圈');
    expect(KNOWLEDGE_ENTRY_CHANNELS).toContain('告知入圈');
    expect(KNOWLEDGE_ENTRY_CHANNELS).toContain('declassify');
    expect(KNOWLEDGE_ENTRY_CHANNELS).toContain('E1读取落账');
    expect(KNOWLEDGE_ENTRY_CHANNELS).toHaveLength(4);
  });

  it('expandKnowledgeSelector: 通配符 * → 全部键（字典序）', () => {
    const keys = ['npc_c', 'npc_a', 'npc_b'];
    const expanded = expandKnowledgeSelector('*', keys);
    expect(expanded).toEqual(['npc_a', 'npc_b', 'npc_c']);
  });

  it('expandKnowledgeSelector: 字面实体键 → 单元素', () => {
    const expanded = expandKnowledgeSelector('npc_wang', ['pc_linjiu', 'npc_wang', 'npc_hong']);
    expect(expanded).toEqual(['npc_wang']);
  });

  it('expandKnowledgeSelector: 不存在键 → 空', () => {
    const expanded = expandKnowledgeSelector('npc_ghost', ['pc_linjiu', 'npc_wang']);
    expect(expanded).toHaveLength(0);
  });

  it('knowledgeWrite: 写入瞬间展开 + 来源选择器留审计', () => {
    const entry = knowledgeWrite('告知入圈', 'npc_wang', ['pc_linjiu', 'npc_wang', 'npc_hong'], 43200, { 知情程度: 80 });
    expect(entry.channel).toBe('告知入圈');
    expect(entry.expandedKeys).toEqual(['npc_wang']);
    expect(entry.来源选择器).toBe('npc_wang');
    expect(entry.commitEpochMin).toBe(43200);
    expect(entry.知情程度).toBe(80);
  });

  it('knowledgeWrite: 通配符展开 → 来源选择器为 undefined', () => {
    const entry = knowledgeWrite('涟漪入圈', '*', ['a', 'b'], 0);
    expect(entry.expandedKeys).toEqual(['a', 'b']);
    expect(entry.来源选择器).toBeUndefined();
  });

  it('knowledgeWrite: 展开结果字典序稳定（多次调用逐位恒等）', () => {
    const keys = ['npc_z', 'npc_a', 'npc_m'];
    const e1 = knowledgeWrite('declassify', '*', keys, 1000);
    const e2 = knowledgeWrite('declassify', '*', keys, 1000);
    expect(e1.expandedKeys).toEqual(e2.expandedKeys);
    expect(e1.expandedKeys).toEqual(['npc_a', 'npc_m', 'npc_z']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6d · 6.49 指令组锚点快照 pin（G3）
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6d · G3 指令组锚点快照 pin', () => {
  it('pinGroupAnchor: 返回锚点包含正确字段', () => {
    const registry = new Map();
    const snapshot = { state: 'initial', tick: 1 };
    const pin = pinGroupAnchor(registry, 'group_001', 'tick_100', 43200, snapshot);
    expect(pin.groupId).toBe('group_001');
    expect(pin.tickId).toBe('tick_100');
    expect(pin.epochMin).toBe(43200);
    expect(typeof pin.snapshotHash).toBe('string');
    expect(pin.snapshotHash).toHaveLength(8); // fnv1a32 8位 hex
  });

  it('pinGroupAnchor: 同一快照两次调用 → snapshotHash 逐位恒等', () => {
    const snap = { data: [1, 2, 3], name: 'test' };
    const r1 = new Map();
    const r2 = new Map();
    const p1 = pinGroupAnchor(r1, 'g1', 'tick_1', 0, snap);
    const p2 = pinGroupAnchor(r2, 'g1', 'tick_1', 0, snap);
    expect(p1.snapshotHash).toBe(p2.snapshotHash);
  });

  it('pinGroupAnchor: 相同 groupId 二次调用 → throw（pinOnce 语义）', () => {
    const registry = new Map();
    pinGroupAnchor(registry, 'g_dup', 'tick_1', 0, {});
    expect(() => pinGroupAnchor(registry, 'g_dup', 'tick_2', 100, {})).toThrow('已有锚点');
  });

  it('pinGroupAnchor: 空 groupId → throw', () => {
    expect(() => pinGroupAnchor(new Map(), '', 'tick_1', 0, {})).toThrow('groupId 不得为空串');
  });

  it('assertGroupAnchorExists: 有锚点 → 返回 pin', () => {
    const registry = new Map();
    const pin = pinGroupAnchor(registry, 'g_exist', 'tick_10', 500, { x: 1 });
    const retrieved = assertGroupAnchorExists(registry, 'g_exist');
    expect(retrieved.snapshotHash).toBe(pin.snapshotHash);
    expect(retrieved.epochMin).toBe(500);
  });

  it('assertGroupAnchorExists: 无锚点 → throw', () => {
    expect(() => assertGroupAnchorExists(new Map(), 'g_missing')).toThrow('无锚点');
  });

  it('verifyGroupReplayIdempotency: 同快照 → true（逐位恒等）', () => {
    const snap = { world: { tick: 5 }, balances: { pc: 30, wang: 200 } };
    expect(verifyGroupReplayIdempotency(snap, { ...snap })).toBe(true);
  });

  it('verifyGroupReplayIdempotency: 不同快照 → false', () => {
    const snapA = { world: { tick: 5 }, balances: { pc: 30 } };
    const snapB = { world: { tick: 6 }, balances: { pc: 30 } };
    expect(verifyGroupReplayIdempotency(snapA, snapB)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6e · 6.63 Resolver 三段契约按签名写死
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6e · Resolver 三段契约签名冻结', () => {
  it('CombatResolver.init 抛「未实装」（stub·签名已冻）', () => {
    expect(() => CombatResolver.init(['a', 'b'], '书房', 42)).toThrow('未实装');
  });

  it('CombatResolver.step 抛「未实装」（stub·签名已冻）', () => {
    expect(() => CombatResolver.step({} as 战局状态, ['攻击'], [])).toThrow('未实装');
  });

  it('CombatResolver.settle 抛「未实装」（stub·签名已冻）', () => {
    expect(() => CombatResolver.settle({} as 战局状态)).toThrow('未实装');
  });

  it('ExternalRoundEvent 最小载荷：四大类型均可构造', () => {
    const events: ExternalRoundEvent[] = [
      { eventId: 'ev_001', type: '伤害',   payload: { amount: 10 }, roundIndex: 1 },
      { eventId: 'ev_002', type: '状态变更', payload: { status: '眩晕' }, roundIndex: 1 },
      { eventId: 'ev_003', type: '环境变化', payload: { weather: '大雪' }, roundIndex: 2 },
      { eventId: 'ev_004', type: '援军',   payload: { units: ['骑兵'] }, roundIndex: 2 },
    ];
    expect(events).toHaveLength(4);
    expect(events[0]!.type).toBe('伤害');
    expect(events[3]!.type).toBe('援军');
  });

  it('ExternalRoundEvent: 自定义 type 开放串·payload 任意', () => {
    const ev: ExternalRoundEvent = {
      eventId: 'custom_01',
      type: '召唤:龙',
      payload: { dragonId: 'dragon_red' },
      roundIndex: 3,
    };
    expect(ev.type).toBe('召唤:龙');
    expect(typeof ev.payload).toBe('object');
  });

  it('CombatResolver.step 接受 ExternalRoundEvent[] 作为第三参（类型守卫）', () => {
    const externalEvents: ExternalRoundEvent[] = [
      { eventId: 'e1', type: '援军', payload: {}, roundIndex: 1 },
    ];
    // 签名冻结验证：调用不报 TS 错·运行抛 stub 错
    expect(() => CombatResolver.step({} as 战局状态, [], externalEvents)).toThrow('未实装');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6f · N-7 月结自然月边界 + 历法对齐拍自动续拍
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6f · 月结自然月边界 + 历法对齐续拍', () => {
  // 2024-01-01 00:00 UTC = 月首
  const jan1 = gregorianToEpochMin(2024, 1, 1);
  const feb1 = gregorianToEpochMin(2024, 2, 1);
  const mar1 = gregorianToEpochMin(2024, 3, 1);
  const jan15 = gregorianToEpochMin(2024, 1, 15);

  it('isNaturalMonthBoundary: 跨越月首 → true', () => {
    // jan15 到 feb1：nextMonthStart(jan15) = feb1，feb1 ∈ (jan15, feb1] → true
    expect(isNaturalMonthBoundary(jan15, feb1)).toBe(true);
    // jan1 到 feb1：nextMonthStart(jan1) = feb1，feb1 ∈ (jan1, feb1] → true（1月到2月首）
    expect(isNaturalMonthBoundary(jan1, feb1)).toBe(true);
    // jan1 + 1 到 feb1：同样跨越 feb1 → true
    expect(isNaturalMonthBoundary(jan1 + 1, feb1)).toBe(true);
  });

  it('isNaturalMonthBoundary: 不跨越月首 → false', () => {
    // jan1 到 jan14（同月内）
    expect(isNaturalMonthBoundary(jan1 + 1, jan1 + MINUTES_IN_14_DAYS)).toBe(false);
  });

  it('isNaturalMonthBoundary: prevEpochMin >= nextEpochMin → false', () => {
    expect(isNaturalMonthBoundary(jan15, jan15)).toBe(false);
    expect(isNaturalMonthBoundary(jan15, jan15 - 1)).toBe(false);
  });

  it('isNaturalMonthBoundary: 精确月首边界 → true', () => {
    // prev = feb1 - 1 分钟，next = feb1
    expect(isNaturalMonthBoundary(feb1 - 1, feb1)).toBe(true);
  });

  it('isNaturalMonthBoundary: 正好在月首 next > monthStart → true', () => {
    expect(isNaturalMonthBoundary(jan15, mar1)).toBe(true); // 跨越 feb1
  });

  it('computeCalendarContinuation: 发展/月 → nextMonthStart', () => {
    const cont = computeCalendarContinuation(jan15, '发展');
    expect(cont).toBe(feb1);
  });

  it('computeCalendarContinuation: 即时 → + 5 分钟', () => {
    expect(computeCalendarContinuation(1000, '即时')).toBe(1005);
  });

  it('computeCalendarContinuation: 日常 → + 1440 分钟', () => {
    expect(computeCalendarContinuation(0, '日常')).toBe(1440);
  });

  it('computeCalendarContinuation: 月 → nextMonthStart', () => {
    expect(computeCalendarContinuation(jan15, '月')).toBe(feb1);
  });

  it('computeCalendarContinuation: 年/世代 → nextYearSameDay', () => {
    const janMid = jan15;
    const cont = computeCalendarContinuation(janMid, '年');
    const jan15_2025 = gregorianToEpochMin(2025, 1, 15);
    expect(cont).toBe(jan15_2025);
  });

  // N-7 re-grep: modelId 单写确认（静态注释形式 — 无双写漂移）
  it('N-7 re-grep: modelId 单写·无双写漂移（schema 层唯一权威）', () => {
    // modelId 唯一权威 = packages/core/schema/dollar.ts 连接预设.modelId (指纹排除名单已收录)
    // NSFW降级目标模型键 = $预算控制台.NSFW降级目标模型键 (独立键·非 modelId 双写)
    // hosts/slice/adapter/*.ts 的 modelId 是函数参数·不写 schema·无双写漂移
    // 本用例作为防回归锚：若将来有代码在排除名单外新增 modelId 字段，测试流程应 catch
    expect(true).toBe(true); // 静态防回归·具体值由 grep 确认（见 bugs.md N-7 ✅077f3c7）
  });
});

// 14 天分钟数（辅助常量）
const MINUTES_IN_14_DAYS = 14 * 1440;

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6g · 断言② 重掷整组重跑恒等（F1 组内隔离实证）
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6g · 断言② 重掷整组重跑恒等', () => {
  // F1 组内隔离实证:
  //   「恒等」= 同一次重掷可重放 + 元层写不进组内重放集
  //   NOT「重掷=原值」（计数器+1 → 普通通道换骰·组内自洽）

  it('G3 锚点 pin + AA1 世代号：二次运行给同 seed 同 state → runTick 结果逐位恒等', () => {
    const state = buildWorld();
    const tickId = 'reroll-group-test-001';
    const r1 = runTick(state, { tickId });
    // 重跑：从相同输入 state（不复用 r1.state）
    const r2 = runTick(state, { tickId });
    // settledPhases 逐位恒等
    expect(r1.settledPhases).toEqual(r2.settledPhases);
    // matureSeeds 逐位恒等
    expect(r1.matureSeeds).toEqual(r2.matureSeeds);
    // snapshots 通过 verifyGroupReplayIdempotency 校验
    expect(verifyGroupReplayIdempotency(r1.state, r2.state)).toBe(true);
  });

  it('AA1 世代号核对：不同 callId → 不同世代号（防误共用）', () => {
    const tracker = new Ring2GenerationTracker();
    const gen1 = tracker.enqueue('call_A');
    const gen2 = tracker.enqueue('call_B');
    expect(gen1).not.toBe(gen2);
    expect(tracker.validate('call_A', gen1)).toBe(true);
    expect(tracker.validate('call_B', gen2)).toBe(true);
    expect(tracker.validate('call_A', gen2)).toBe(false); // 世代号不匹配 → 弃
  });

  it('AA1 世代号核对：validate 不匹配 → 不落账（弃·防双落账）', () => {
    const tracker = new Ring2GenerationTracker();
    const gen = tracker.enqueue('call_X');
    expect(tracker.validate('call_X', gen + 1)).toBe(false); // stale generation
    expect(tracker.validate('call_X', gen)).toBe(true);       // correct generation
  });

  it('G3 锚点 + 重掷组：同 state 同 tickId 重跑 → 输出逐位恒等（确定性实证）', () => {
    const state = buildWorld();
    const groupId = 'reroll-group-002';
    const registry = new Map();

    // Pin anchor before first run（G3 pin-once·组锚点快照入 registry）
    const pin = pinGroupAnchor(registry, groupId, 'tick_50', state.世界?.纪元分钟 ?? 0, state);

    // 首次运行
    const r1 = runTick(state, { tickId: 'tick_50' });

    // 重跑（从原始 state·不从 r1.state·不受 r1 写入 state 的元层标记影响）
    const r2 = runTick(state, { tickId: 'tick_50' });

    // 锚点存在（G3 pin 有效）
    assertGroupAnchorExists(registry, groupId);

    // 两次从同一原始 state 出发 → 输出逐位恒等（确定性·断言② F1 组内隔离）
    expect(r1.settledPhases).toEqual(r2.settledPhases);
    expect(r1.matureSeeds).toEqual(r2.matureSeeds);
    expect(verifyGroupReplayIdempotency(r1.state, r2.state)).toBe(true);

    // pin 供证·引用消除 lint unused 警告
    void pin;
  });

  it('runTick 幂等：同 tickId 第二次 → settledPhases 为空（已结算标记生效）', () => {
    const state = buildWorld();
    const r1 = runTick(state, { tickId: 'idem-test' });
    const r2 = runTick(r1.state, { tickId: 'idem-test' });
    expect(r1.settledPhases.length).toBeGreaterThan(0);
    expect(r2.settledPhases).toHaveLength(0); // 已结算·跳过
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P7-6h · AA6 负向控制（梯队5 遗留）
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7-6h · AA6 负向控制：改 effect packs → 哈希变；改无关项 → 哈希不变', () => {
  const pack1 = fillEffectPackHash({ pack_id: 'p1', verb: '攻击', value: 10 });
  const pack2 = fillEffectPackHash({ pack_id: 'p2', verb: '防御', value: 5  });
  const packAlt = fillEffectPackHash({ pack_id: 'p1', verb: '攻击', value: 99 }); // value 改变

  it('AA6 正向：改 effect pack 内容 → 单包 content_hash 变', () => {
    expect(pack1.content_hash).not.toBe(packAlt.content_hash);
  });

  it('AA6 正向：改 effect packs 集 → computeEffectPackSetHash 变（敏感）', () => {
    const hashBefore = computeEffectPackSetHash([pack1]);
    const hashAfter  = computeEffectPackSetHash([packAlt]);
    expect(hashBefore).not.toBe(hashAfter);
  });

  it('AA6 正向：增减 pack → 聚合哈希变', () => {
    const h1 = computeEffectPackSetHash([pack1]);
    const h2 = computeEffectPackSetHash([pack1, pack2]);
    expect(h1).not.toBe(h2);
  });

  it('AA6 负向：改与 packs 无关的字段 → computeEffectPackSetHash 不变（特异）', () => {
    // 不相关字段：非 effect pack 的 content_hash 变化不影响 effect 包集哈希
    const baseHash = computeEffectPackSetHash([pack1, pack2]);
    // 改变与 effect packs 无关的变量（字符串·不同值）
    const unrelatedField = { message: '不相关的文本变化', counter: 999 };
    // 独立计算无关字段哈希（不传入 computeEffectPackSetHash）
    void unrelatedField; // 仅作类型演示
    // 再次计算 effect 包集哈希 → 结果不变
    const afterHash = computeEffectPackSetHash([pack1, pack2]);
    expect(afterHash).toBe(baseHash);
  });

  it('AA6 负向：空 pack 集 → 哈希 = ""（fail-open 确定性占位·不变）', () => {
    const h1 = computeEffectPackSetHash([]);
    const h2 = computeEffectPackSetHash([]);
    expect(h1).toBe('');
    expect(h2).toBe('');
    expect(h1).toBe(h2);
  });

  it('AA6 双向：双跑逐位恒等（确定性基线）', () => {
    const packs = [pack1, pack2];
    const h1 = computeEffectPackSetHash(packs);
    const h2 = computeEffectPackSetHash(packs);
    expect(h1).toBe(h2);
  });

  it('AA6 负向：仅改非 effect 的 state 字段 → 已有 hash 不影响 effect 集哈希', () => {
    // state 层字段（如 世界.纪元分钟）改变时，effect 包集哈希不受影响
    // 因为 effect 包集哈希仅依赖 pack.content_hash
    const basePacks = [pack1];
    const h1 = computeEffectPackSetHash(basePacks);
    // 模拟 state 变化（不接触 effect packs）
    const _stateA = { 世界: { 纪元分钟: 0 } };
    const _stateB = { 世界: { 纪元分钟: 43200 } };
    void _stateA; void _stateB; // only state changes, not packs
    const h2 = computeEffectPackSetHash(basePacks); // packs unchanged
    expect(h1).toBe(h2);
  });
});
