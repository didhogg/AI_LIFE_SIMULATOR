// P0-7 梯队5 验收测试 — P0-6→P0-7 解锁件接线
// DoD 行为断言：
//   P7-5a: G7 死亡拦截器硬顶 — 两包时首命中即停·第二包不拦截
//   P7-5b: V3 展开器 runtime — 通配符→Unicode字典序·字面键→单元素·空槽→空
//   P7-5c: H-c-4 五道闸钳制 — _前缀拒·白名单拒·max_delta截断·ok=false整包拒
//   P7-5c: F-a content_hash — fillEffectPackHash 稳定·isEffectPackHashStale 检测变化
//   P7-5c: AA6 双向断言 — 改包集→哈希变·改无关项→哈希不变
//   P7-5d: L-21 重要度冻结 — 首次冻结成功·二次冻结抛出·assertImportanceFrozen 通过
//   P7-5e: H-c-3 主权地板 — 死亡无授权拦截·凌驾抢话档放行·非地板事件直通
//   P7-5f: Q批 约定库写入 — Q1创建/Q2修改/Q4追加/Q6解除（幂等）
//   P7-5f: V3 写入口 — verbWriteToTargets 按序写入

import { describe, it, expect } from 'vitest';

import {
  scanDeathIntercept,
  DEATH_INTERCEPT_TRIGGER,
} from '@ai-life-sim/core/engine/deathIntercept';

import {
  expandVerbTarget,
  applyVerbToTargets,
  VERB_TARGET_WILDCARD,
  VERB_TARGET_WILDCARD_ZH,
} from '@ai-life-sim/core/engine/verbExpand';

import {
  fillEffectPackHash,
  isEffectPackHashStale,
  runEffectGates,
  computeEffectPackSetHash,
} from '@ai-life-sim/core/engine/effectGate';

import {
  freezeImportanceScore,
  assertImportanceFrozen,
  readFrozenScore,
} from '@ai-life-sim/core/engine/importanceFreeze';

import {
  checkSovereigntyFloor,
  autoFloorAuthorization,
  isFloorEvent,
} from '@ai-life-sim/core/engine/sovereigntyFloor';

import {
  covenantCreate,
  covenantUpdate,
  covenantAppendTerm,
  covenantRelease,
  verbWriteToTargets,
} from '@ai-life-sim/core/engine/covenantWrite';

// ── P7-5a · G7 死亡拦截器硬顶 ───────────────────────────────────────────────

describe('P7-5a · G7 死亡拦截器硬顶', () => {
  it('DEATH_INTERCEPT_TRIGGER 常量值正确', () => {
    expect(DEATH_INTERCEPT_TRIGGER).toBe('天命:生死判定');
  });

  it('单包命中 → 返回 pack_id', () => {
    const packs = [
      { pack_id: 'pack_A', trigger: '天命:生死判定' },
      { pack_id: 'pack_B', trigger: '天命:生死判定' },
    ];
    const result = scanDeathIntercept(packs);
    expect(result).toBe('pack_A'); // 首命中即停
  });

  it('两个拦截包 → 只取首命中（硬顶·不叠加）', () => {
    const packs = [
      { pack_id: 'intercept_1', trigger: DEATH_INTERCEPT_TRIGGER },
      { pack_id: 'intercept_2', trigger: DEATH_INTERCEPT_TRIGGER },
    ];
    const hit = scanDeathIntercept(packs);
    expect(hit).toBe('intercept_1');
    // 第二包 intercept_2 不拦截（首命中已停止）
  });

  it('无命中包 → 返回 null', () => {
    const packs = [
      { pack_id: 'pack_X', trigger: '触发:遭遇战' },
      { pack_id: 'pack_Y' },
    ];
    expect(scanDeathIntercept(packs)).toBeNull();
  });

  it('空列表 → 返回 null', () => {
    expect(scanDeathIntercept([])).toBeNull();
  });

  it('首包非拦截·次包拦截 → 返回次包', () => {
    const packs = [
      { pack_id: 'normal', trigger: '触发:天气' },
      { pack_id: 'guard',  trigger: DEATH_INTERCEPT_TRIGGER },
    ];
    expect(scanDeathIntercept(packs)).toBe('guard');
  });
});

// ── P7-5b · V3 展开器 runtime ─────────────────────────────────────────────

describe('P7-5b · V3 展开器 runtime', () => {
  const entities = ['乙', '丙', '甲']; // 刻意乱序

  it('通配符 * → 全部键 Unicode 码点序', () => {
    const result = expandVerbTarget(VERB_TARGET_WILDCARD, entities);
    // Unicode 码点序 (Array.sort() 默认·禁 localeCompare)
    const expected = [...entities].sort();
    expect(result).toEqual(expected);
  });

  it('通配符 "全部" → 全部键 Unicode 码点序', () => {
    const result = expandVerbTarget(VERB_TARGET_WILDCARD_ZH, entities);
    expect(result).toEqual([...entities].sort());
  });

  it('字面键精确匹配 → 单元素列表', () => {
    expect(expandVerbTarget('甲', entities)).toEqual(['甲']);
  });

  it('空槽 → 空列表（无目标）', () => {
    expect(expandVerbTarget('', entities)).toEqual([]);
  });

  it('未知选择器（非键·非通配符）→ 空列表（defer P2）', () => {
    expect(expandVerbTarget('未知选择器', entities)).toEqual([]);
  });

  it('Unicode 码点序确定性：多次调用结果相同', () => {
    const r1 = expandVerbTarget('*', ['丙', '甲', '乙']);
    const r2 = expandVerbTarget('*', ['丙', '甲', '乙']);
    expect(r1).toEqual(r2);
  });

  it('applyVerbToTargets：按展开序依次写入', () => {
    const targets = expandVerbTarget('*', ['B', 'A', 'C']);
    const log: string[] = [];
    applyVerbToTargets(targets, (acc: string[], key) => { acc.push(key); return acc; }, log);
    expect(log).toEqual(['A', 'B', 'C']); // ASCII Unicode 升序
  });

  it('applyVerbToTargets 空目标 → 原 state 不变', () => {
    const state = { count: 0 };
    const result = applyVerbToTargets([], (s) => ({ ...s, count: s.count + 1 }), state);
    expect(result).toBe(state); // 同一引用
  });
});

// ── P7-5c · H-c-4 五道闸钳制 ────────────────────────────────────────────────

describe('P7-5c · H-c-4 五道闸钳制', () => {
  it('_前缀路径 → 拒绝（闸③）·ok=false', () => {
    const pack = { deltas: [{ path: '_内部状态', op: 'set' as const, value: 100 }] };
    const result = runEffectGates(pack);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('前缀权限[③]');
    expect(result.clampedDeltas[0]!.clamped).toBe(false);
  });

  it('$前缀路径 → 拒绝（闸③）', () => {
    const pack = { deltas: [{ path: '$会话状态', op: 'set' as const, value: 1 }] };
    const result = runEffectGates(pack);
    expect(result.ok).toBe(false);
  });

  it('白名单非空·path 不在白名单 → 拒绝（闸②）', () => {
    const pack = { deltas: [{ path: '角色.体力', op: 'add' as const, value: 10 }] };
    const wl = new Set<string>(['角色.魅力']);
    const result = runEffectGates(pack, wl);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('白名单[②]');
  });

  it('max_delta=50 · value=100 → 截断到 50（闸④）', () => {
    const pack = { deltas: [{ path: '角色.体力', op: 'add' as const, value: 100, max_delta: 50 }] };
    const result = runEffectGates(pack);
    expect(result.ok).toBe(true);
    expect(result.clampedDeltas[0]!.value).toBe(50);
    expect(result.clampedDeltas[0]!.clamped).toBe(true);
  });

  it('max_delta=50 · value=-100 → 截断到 -50（负向 clamp）', () => {
    const pack = { deltas: [{ path: '角色.体力', op: 'add' as const, value: -100, max_delta: 50 }] };
    const result = runEffectGates(pack);
    expect(result.clampedDeltas[0]!.value).toBe(-50);
    expect(result.clampedDeltas[0]!.clamped).toBe(true);
  });

  it('max_delta=50 · value=30 → 通过·不截断', () => {
    const pack = { deltas: [{ path: '角色.体力', op: 'add' as const, value: 30, max_delta: 50 }] };
    const result = runEffectGates(pack);
    expect(result.ok).toBe(true);
    expect(result.clampedDeltas[0]!.value).toBe(30);
    expect(result.clampedDeltas[0]!.clamped).toBe(false);
  });

  it('ok=false → 调用方应原子拒绝整包（闸⑤契约验证）', () => {
    const pack = { deltas: [
      { path: '角色.体力', op: 'add' as const, value: 10 },  // 正常
      { path: '_内部状态', op: 'set' as const, value: 1 },   // 被拒
    ]};
    const result = runEffectGates(pack);
    expect(result.ok).toBe(false); // 整包被拒
    expect(result.clampedDeltas.length).toBe(2); // 仍返回所有 delta 供诊断
  });

  it('空 deltas → ok=true·clampedDeltas 为空', () => {
    const result = runEffectGates({ deltas: [] });
    expect(result.ok).toBe(true);
    expect(result.clampedDeltas.length).toBe(0);
  });
});

// ── P7-5c · F-a content_hash 自动填充 ───────────────────────────────────────

describe('P7-5c · F-a content_hash 自动填充', () => {
  it('fillEffectPackHash 产生 content_hash 字段', () => {
    const pack = { pack_id: 'p1', trigger: '触发:击杀', deltas: [] };
    const filled = fillEffectPackHash(pack);
    expect(typeof filled.content_hash).toBe('string');
    expect(filled.content_hash.length).toBe(8); // fnv1a32 8位十六进制
  });

  it('相同内容 → 相同 content_hash（稳定·确定性）', () => {
    const pack = { pack_id: 'p1', deltas: [] };
    const h1 = fillEffectPackHash(pack).content_hash;
    const h2 = fillEffectPackHash(pack).content_hash;
    expect(h1).toBe(h2);
  });

  it('content_hash 字段本身不进入哈希计算（排除自身）', () => {
    const pack = { pack_id: 'p1', deltas: [] };
    const filled = fillEffectPackHash(pack);
    // 填充后再次计算应得到相同结果（content_hash 被排除）
    const refill = fillEffectPackHash(filled);
    expect(refill.content_hash).toBe(filled.content_hash);
  });

  it('isEffectPackHashStale：内容未变 → false', () => {
    const pack = { pack_id: 'p1', deltas: [] };
    const filled = fillEffectPackHash(pack);
    expect(isEffectPackHashStale(filled)).toBe(false);
  });

  it('isEffectPackHashStale：内容变化后 → true（热加载检测）', () => {
    const pack = { pack_id: 'p1', deltas: [], content_hash: 'deadbeef' }; // 过期哈希
    expect(isEffectPackHashStale(pack)).toBe(true);
  });

  it('热加载重算：同一包两次 fillEffectPackHash → 哈希恒等', () => {
    const pack = { pack_id: 'p2', trigger: '触发:交易', deltas: [{ path: '货币.金币', op: 'add', value: 50 }] };
    const a = fillEffectPackHash(pack);
    const b = fillEffectPackHash(pack);
    expect(a.content_hash).toBe(b.content_hash);
  });
});

// ── P7-5c · AA6 双向断言 ─────────────────────────────────────────────────────

describe('P7-5c · AA6 双向断言', () => {
  it('改 effect 包 → 聚合哈希变（该变时变）', () => {
    const packA = fillEffectPackHash({ pack_id: 'p1', deltas: [] });
    const packB = fillEffectPackHash({ pack_id: 'p2', deltas: [{ path: 'hp', op: 'add', value: 1 }] });
    const h1 = computeEffectPackSetHash([packA]);
    const h2 = computeEffectPackSetHash([packB]);
    expect(h1).not.toBe(h2);
  });

  it('增加 effect 包 → 聚合哈希变', () => {
    const p = fillEffectPackHash({ pack_id: 'p1', deltas: [] });
    const h1 = computeEffectPackSetHash([p]);
    const h2 = computeEffectPackSetHash([p, fillEffectPackHash({ pack_id: 'p2', deltas: [] })]);
    expect(h1).not.toBe(h2);
  });

  it('改无关字段（非 content_hash·非 deltas）→ 聚合哈希应变（包内容变）', () => {
    const packA = fillEffectPackHash({ pack_id: 'p1', deltas: [] });
    const packB = fillEffectPackHash({ pack_id: 'p1_changed_id', deltas: [] });
    // pack_id 不同 → content_hash 不同 → 聚合哈希不同
    expect(packA.content_hash).not.toBe(packB.content_hash);
  });

  it('空包集 → 稳定占位串（fail-open 确定性）', () => {
    const h1 = computeEffectPackSetHash([]);
    const h2 = computeEffectPackSetHash([]);
    expect(h1).toBe(h2);
  });
});

// ── P7-5d · L-21 重要度冻结 ──────────────────────────────────────────────────

describe('P7-5d · L-21 重要度冻结', () => {
  it('freezeImportanceScore 首次冻结成功·返回冻结结果', () => {
    const entry = {};
    const result = freezeImportanceScore(entry, 75);
    expect(result.权重).toBe(75);
    expect(result.权重_冻结).toBe(true);
  });

  it('二次 freeze 调用抛出（L-21 不可逆）', () => {
    const frozen = { 权重: 75, 权重_冻结: true };
    expect(() => freezeImportanceScore(frozen, 80)).toThrow('L-21 违规');
  });

  it('assertImportanceFrozen 通过（已冻结）', () => {
    const entry = { 权重: 60, 权重_冻结: true };
    expect(() => assertImportanceFrozen(entry, 'mem_001')).not.toThrow();
  });

  it('assertImportanceFrozen 抛出（未冻结）', () => {
    const entry = { 权重: 60 };
    expect(() => assertImportanceFrozen(entry, 'mem_002')).toThrow('L-21 守卫');
  });

  it('二次读取与首次读取值相同（冻结不变性）', () => {
    const entry = { 权重: 88, 权重_冻结: true };
    expect(readFrozenScore(entry)).toBe(88);
    expect(readFrozenScore(entry)).toBe(88); // 二读恒等
  });

  it('readFrozenScore 未冻结时返回 defaultValue（fail-open）', () => {
    expect(readFrozenScore({})).toBe(50);
    expect(readFrozenScore({ 权重: 70 })).toBe(50); // 未冻结不返回分值
  });

  it('分值 clamp [0,100]：超上限→100·超下限→0', () => {
    expect(freezeImportanceScore({}, 150).权重).toBe(100);
    expect(freezeImportanceScore({}, -5).权重).toBe(0);
  });
});

// ── P7-5e · H-c-3 主权降级地板 ───────────────────────────────────────────────

describe('P7-5e · H-c-3 主权降级地板', () => {
  it('「死亡」无授权 → blocked=true', () => {
    const result = checkSovereigntyFloor('死亡', undefined);
    expect(result.blocked).toBe(true);
    expect(result.required).toBe('凌驾抢话档');
  });

  it('「死亡」+「凌驾抢话档」→ blocked=false（放行）', () => {
    const result = checkSovereigntyFloor('死亡', '凌驾抢话档');
    expect(result.blocked).toBe(false);
  });

  it('「婚姻」无授权 → blocked=true', () => {
    expect(checkSovereigntyFloor('婚姻', undefined).blocked).toBe(true);
  });

  it('「血脉绑定」无授权 → blocked=true', () => {
    expect(checkSovereigntyFloor('血脉绑定', undefined).blocked).toBe(true);
  });

  it('「绑架」无授权 → blocked=true', () => {
    expect(checkSovereigntyFloor('绑架', undefined).blocked).toBe(true);
  });

  it('「永久失核心资产」无授权 → blocked=true', () => {
    expect(checkSovereigntyFloor('永久失核心资产', undefined).blocked).toBe(true);
  });

  it('「需确认」级别不足（非「凌驾抢话档」）→ blocked=true', () => {
    const result = checkSovereigntyFloor('死亡', '需确认');
    expect(result.blocked).toBe(true);
  });

  it('非地板事件（普通对话）→ blocked=false·required=null', () => {
    const result = checkSovereigntyFloor('普通对话', undefined);
    expect(result.blocked).toBe(false);
    expect(result.required).toBeNull();
  });

  it('autoFloorAuthorization：地板事件+未授权 → 强制写入「凌驾抢话档」', () => {
    expect(autoFloorAuthorization('死亡', undefined)).toBe('凌驾抢话档');
    expect(autoFloorAuthorization('婚姻', '需确认')).toBe('凌驾抢话档');
  });

  it('autoFloorAuthorization：已授权 → 不变', () => {
    expect(autoFloorAuthorization('死亡', '凌驾抢话档')).toBe('凌驾抢话档');
  });

  it('autoFloorAuthorization：非地板事件 → 原值不变', () => {
    expect(autoFloorAuthorization('普通对话', undefined)).toBeUndefined();
  });

  it('isFloorEvent 正确分类', () => {
    expect(isFloorEvent('死亡')).toBe(true);
    expect(isFloorEvent('婚姻')).toBe(true);
    expect(isFloorEvent('普通对话')).toBe(false);
  });
});

// ── P7-5f · Q批 约定库写入 ───────────────────────────────────────────────────

const EMPTY_LIB = {};

describe('P7-5f · Q1 创建约定', () => {
  it('Q1 创建新约定条目', () => {
    const lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [{ 标的: 'npc_wang' }] });
    expect(lib['c_001']).toBeDefined();
    expect(lib['c_001']!.条款.length).toBe(1);
  });

  it('Q1 key 已存在 → 抛出（禁覆盖）', () => {
    const lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [] });
    expect(() => covenantCreate(lib, 'c_001', { 条款: [] })).toThrow('Q1');
  });

  it('Q1 纯函数：原 library 不变', () => {
    covenantCreate(EMPTY_LIB, 'new_key', { 条款: [] });
    expect(EMPTY_LIB).toEqual({});
  });
});

describe('P7-5f · Q2 修改约定', () => {
  it('Q2 修改现有约定（浅合并）', () => {
    let lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [{ 标的: 'npc_a' }], 备注: '初始' });
    lib = covenantUpdate(lib, 'c_001', { 备注: '已更新' });
    expect(lib['c_001']!['备注']).toBe('已更新');
    expect(lib['c_001']!.条款.length).toBe(1); // 条款保留
  });

  it('Q2 key 不存在 → 抛出', () => {
    expect(() => covenantUpdate(EMPTY_LIB, 'ghost', { 备注: 'x' })).toThrow('Q2');
  });
});

describe('P7-5f · Q4 追加条款', () => {
  it('Q4 追加条款（append-only）', () => {
    let lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [{ 标的: 'npc_a' }] });
    lib = covenantAppendTerm(lib, 'c_001', { 标的: 'npc_b', 金额: 100 });
    expect(lib['c_001']!.条款.length).toBe(2);
    expect(lib['c_001']!.条款[1]!['标的']).toBe('npc_b');
  });

  it('Q4 key 不存在 → 抛出', () => {
    expect(() => covenantAppendTerm(EMPTY_LIB, 'ghost', { 标的: 'x' })).toThrow('Q4');
  });

  it('Q4 已解除的约定 → 禁止追加条款', () => {
    let lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [] });
    lib = covenantRelease(lib, 'c_001');
    expect(() => covenantAppendTerm(lib, 'c_001', { 标的: 'x' })).toThrow('Q4');
  });
});

describe('P7-5f · Q6 解除约定', () => {
  it('Q6 软删除约定（已解除=true）', () => {
    let lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [] });
    lib = covenantRelease(lib, 'c_001');
    expect(lib['c_001']!.已解除).toBe(true);
    expect(lib['c_001']).toBeDefined(); // 物理 key 保留（审计）
  });

  it('Q6 幂等：二次解除不报错', () => {
    let lib = covenantCreate(EMPTY_LIB, 'c_001', { 条款: [] });
    lib = covenantRelease(lib, 'c_001');
    const lib2 = covenantRelease(lib, 'c_001');
    expect(lib2['c_001']!.已解除).toBe(true);
    expect(lib2).toBe(lib); // 已解除 → 同一引用返回（不变性）
  });

  it('Q6 key 不存在 → 抛出', () => {
    expect(() => covenantRelease(EMPTY_LIB, 'ghost')).toThrow('Q6');
  });
});

// ── P7-5f · V3 写入口 ──────────────────────────────────────────────────────

describe('P7-5f · V3 写入口 verbWriteToTargets', () => {
  it('按 expandedTargets 顺序依次写入', () => {
    const log: string[] = [];
    const writer = (acc: string[], key: string): string[] => [...acc, key];
    const result = verbWriteToTargets(['A', 'B', 'C'], writer, log);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('空目标列表 → 返回原 state', () => {
    const state = { v: 42 };
    const result = verbWriteToTargets([], (s) => ({ ...s }), state);
    expect(result).toBe(state);
  });

  it('V3 + 展开器集成：通配符 → 所有实体 Unicode 序写入', () => {
    const entities = ['丙', '甲', '乙'];
    const expanded = expandVerbTarget('*', entities);
    const visited: string[] = [];
    verbWriteToTargets(expanded, (acc: string[], k: string) => { acc.push(k); return acc; }, visited);
    expect(visited).toEqual(['丙', '乙', '甲']); // Unicode 码点序 丙=0x4E19 < 乙=0x4E59 < 甲=0x7532
  });
});
