// runTick — core settlement engine (纯函数·Ring 0·无 IO·无 LLM 调用)
//
// 设计铁律：
//   • 同输入同输出（确定性·禁 Date.now/Math.random/localeCompare/裸JSON.stringify/NFC平台normalize）
//   • structuredClone 入口深拷·下游操作全在拷贝上·不回写输入 state
//   • 涟漪 ≤ 2 跳·covert 印象仅直接在场方可见
//   • 幂等：已结算 tickId 第二次调用直接返回（已结算标记 = state._系统.已结算标记）
//   • 守恒：原子提交点验 Σ净值 = 拍前快照值（assertConservation 抛 ConservationError）
//
// 结算序（显式数组）：
//   日程结算 → 事件种子萌发 → 阈值触发 → 日期触发 → 标志触发 → 关系触发
//   → 衰减批 → 涟漪传播 → 原子提交
import type { RootState } from '../schema/index.js';
import { assertConservation } from './conservation.js';
import { getNetAsset } from './netAsset.js';
import { decayStep } from './time.js';

// ── 环形缓冲上限 ──────────────────────────────────────────────────────────────
const TICK_LOG_MAX = 8;

// ── 涟漪参数 ──────────────────────────────────────────────────────────────────
const RIPPLE_DECAY          = 0.5;  // 二跳强度乘子（一跳强度 × 信任/100 × RIPPLE_DECAY）
const RIPPLE_MIN            = 1;    // 低于此阈值不写入认知档案（防噪）
const REL_RIPPLE_THRESHOLD  = 50;   // Phase 6 关系触发：|强度|×信任/100 达此阈值才发射

// ── 结算序 ────────────────────────────────────────────────────────────────────

export const SETTLEMENT_PHASES = [
  '日程结算',
  '事件种子萌发',
  '阈值触发',
  '日期触发',
  '标志触发',
  '关系触发',
  '衰减批',
  '涟漪传播',
  '媒介拍末取材', // E4·6.55: 涟漪先落账后·媒介通道（书信/信使等）在拍末采样·然后进原子提交
  '原子提交',
] as const;

export type SettlementPhase = typeof SETTLEMENT_PHASES[number];

// ── 公共接口 ──────────────────────────────────────────────────────────────────

export interface TickInput {
  /** 全局唯一拍 id（幂等键·推荐格式: gen-0:tick-N）*/
  tickId: string;
  /** D4: 埋种子动词的声明域（跨域成熟日换算锚点；缺省 = 母域）*/
  声明域?: string;
  /** 本拍跨度（纪元分钟）；缺省读 state.世界._本拍跨度，再缺省 43200 */
  spanMinutes?: number;
}

export interface TickResult {
  state:          RootState;
  settledPhases:  SettlementPhase[];
  matureSeeds:    string[];           // 本拍成熟的延时种子键列表
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * Run one tick of the settlement engine.
 * Pure function: same (state, input) → same TickResult, no I/O.
 */
export function runTick(state: RootState, input: TickInput): TickResult {
  // [1] 入口深拷 — 全部操作在 s 上进行，不回写 state
  const s = structuredClone(state) as RootState;

  // [3] 幂等检查 — tickId 已全量结算则直接返回
  if (s._系统.已结算标记[input.tickId]?.即时分量 === 1) {
    return { state: s, settledPhases: [], matureSeeds: [] };
  }

  const spanMin     = input.spanMinutes ?? (s.世界?._本拍跨度 ?? 43200);
  const nowEpochMin = s.世界?.纪元分钟 ?? 0;

  // 拍前 Σ净值快照（原子提交守恒基线）
  const 账户 = s.货币系统?.账户;
  const preNetAsset = 账户 && Object.keys(账户).length > 0
    ? Object.values(账户).reduce((sum, acct) => sum + getNetAsset(acct), 0)
    : null;

  const settledPhases: SettlementPhase[] = [];
  const matureSeeds:   string[]           = [];

  // 确保 marker 条目存在
  if (!s._系统.已结算标记[input.tickId]) {
    s._系统.已结算标记[input.tickId] = { 即时分量: 0, 延时分量: {} };
  }
  const phaseMap = s._系统.已结算标记[input.tickId]!.延时分量;

  /** 分量幂等包装：分量已结算则跳过；否则执行 fn 后标记 */
  function runPhase(phase: SettlementPhase, fn: () => void): void {
    if (phaseMap[phase] === 1) return;
    fn();
    phaseMap[phase] = 1;
    settledPhases.push(phase);
  }

  // ── [2] 结算序 ─────────────────────────────────────────────────────────────

  // Phase 1 · 日程结算（stub — 日程处理器 P0-7）
  runPhase('日程结算', () => {
    // TODO(P0-7): fire 日程 action queue → effect pipeline
  });

  // Phase 2 · 事件种子萌发 — D4: 纪元分钟成熟锚
  runPhase('事件种子萌发', () => {
    const seeds = s.$隐藏记忆库?.延时种子 ?? {};
    for (const [key, seed] of Object.entries(seeds)) {
      if (seed.已结算标记 === 1) continue; // 已成熟（种子级幂等）
      // D4: 成熟日 = 0 → 立即成熟哨兵；否则比较全局时刻（纪元分钟）
      const matured = seed.成熟日 === 0 || seed.成熟日 <= nowEpochMin;
      if (matured) {
        seed.已结算标记 = 1;
        matureSeeds.push(key);
        // TODO(P0-7 F-a): generate event from mature seed via effect pack loader
      }
    }
  });

  // Phase 3–5 · 三类触发扫描（stub — P0-7+）
  runPhase('阈值触发', () => {
    // TODO(P0-7): scan threshold triggers
  });
  runPhase('日期触发', () => {
    // TODO(P0-7): scan date triggers (epoch-minute anchors)
  });
  runPhase('标志触发', () => {
    // TODO(P0-7): scan flag triggers
  });

  // Phase 6 · 关系触发 — G1a 发射端：|强度|×信任/100 ≥ REL_RIPPLE_THRESHOLD 的关系推候选涟漪
  runPhase('关系触发', () => {
    const tickNumber = s._tick?.拍计数 ?? 0;
    for (const [, npc] of Object.entries(s.NPC)) {
      for (const rel of npc.关系) {
        if (!rel.对象键) continue;
        const score = Math.abs(rel.强度) * (rel.信任 / 100);
        if (score < REL_RIPPLE_THRESHOLD) continue;
        emitRipple(s.$涟漪候选, rel.对象键, {
          标签:     rel.类型 || '关系',
          极性:     rel.极性 || '中',
          强度:     Math.min(100, Math.round(score)),
          可见性:   '公开',
          来源拍号: tickNumber,
        });
      }
    }
  });

  // Phase 7 · 衰减批 — 三处共用 decayStep（印象/意象/记忆·L-13 统一累加器）
  runPhase('衰减批', () => {
    // 认知档案印象衰减（decayStep 统一实现·禁第二实现）
    for (const observerRec of Object.values(s.认知档案)) {
      for (const targetRec of Object.values(observerRec)) {
        for (const imp of targetRec.印象) {
          if (imp.衰减速率 > 0) {
            imp.强度 = decayStep(imp.强度, imp.衰减速率, spanMin);
          }
        }
        // 剔除衰减至 0 的条目
        targetRec.印象 = targetRec.印象.filter(imp => imp.强度 > 0);
      }
    }
    // NPC 公共意象衰减（decayStep 统一实现）
    for (const npc of Object.values(s.NPC)) {
      for (const img of npc.意象) {
        if (img.衰减速率 > 0) {
          img.强度 = decayStep(img.强度, img.衰减速率, spanMin);
        }
      }
      npc.意象 = npc.意象.filter(img => img.强度 > 0);
    }
    // L-13: 记忆召回权重 recency 衰减（0.995/拍·调用方传入·fixedPow 确定性·禁 Math.pow）
    const MEMORY_RECENCY_RATE = 0.995;
    for (const mem of s.工作记忆 ?? []) {
      if (mem.权重 > 0) {
        mem.权重 = decayStep(mem.权重, 0, 0, MEMORY_RECENCY_RATE);
      }
    }
    for (const mem of s.长期归档 ?? []) {
      if (mem.权重 > 0) {
        mem.权重 = decayStep(mem.权重, 0, 0, MEMORY_RECENCY_RATE);
      }
    }
  });

  // Phase 8 · 涟漪传播 — 2-hop BFS × 衰减 × 知情过滤 × 取 max 防环
  runPhase('涟漪传播', () => {
    propagateRipple(s, nowEpochMin);
  });

  // Phase 8.5 · 媒介拍末取材 — E4·6.55: 涟漪先落账后·媒介通道拍末采样落账
  // 纪律：涟漪传播（Phase 8）必须在媒介取材前完结，保证媒介读取已含涟漪结果。
  runPhase('媒介拍末取材', () => {
    // TODO(P0-7 E1/E2): 遍历媒介登记表·按 E1 读取落账 / E2 书信双宿主在途态 规格取材
    // stub: 媒介通道在此时刻采样·待 E1/E2 consumer 就位后实装
  });

  // Phase 9 · 原子提交 — 守恒验证 + 时钟推进 + tick_log + 全量结算标记
  runPhase('原子提交', () => {
    // 守恒断言（对 stub 阶段无账面变动的 MVP 同样有效；为后续有实体阶段兜底）
    if (账户 && preNetAsset !== null) {
      assertConservation(账户, preNetAsset, getNetAsset);
    }

    // 世界时钟推进（纪元分钟·全局时刻轴）
    if (s.世界) {
      s.世界.纪元分钟 = nowEpochMin + spanMin;
      s.世界.周期数 = (s.世界.周期数 ?? 0) + 1;
    }

    // 拍计数推进（步数序号·仅悔棋/重掷专用·禁折算时长）
    if (s._tick) {
      s._tick.拍计数 = (s._tick.拍计数 ?? 0) + 1;
    }

    // tick_log 环形缓冲追加（上限 TICK_LOG_MAX）
    const logEntry = {
      tick_id:    input.tickId,
      拍计数:     s._tick?.拍计数 ?? 0,
      结果摘要:   `phases:${settledPhases.length} seeds:${matureSeeds.length}`,
      系数组指纹: s._tick?.难度系数组指纹 ?? '',
    };
    s._系统.tick_log.push(logEntry);
    if (s._系统.tick_log.length > TICK_LOG_MAX) {
      s._系统.tick_log = s._系统.tick_log.slice(-TICK_LOG_MAX);
    }

    // 全量结算标记（幂等门控·下次同 tickId 直接返回）
    s._系统.已结算标记[input.tickId]!.即时分量 = 1;
  });

  return { state: s, settledPhases, matureSeeds };
}

// ── 涟漪引擎 ──────────────────────────────────────────────────────────────────

/**
 * 涟漪传播：读 $涟漪候选 → 写认知档案 → 清空 $涟漪候选
 *
 * 一手在场（目标 NPC 所在地点的其他 NPC）→ 沿 关系 边二跳×衰减×信任
 * covert（可见性='隐秘'）= 一跳/二跳均不落印象（走 fact 自带门·零印象）
 * 取 max：同 (observer, target, 标签) 已有印象则取强度较大值（防回路膨胀）
 */
function propagateRipple(s: RootState, nowEpochMin: number): void {
  const pending = s.$涟漪候选;
  if (!pending || Object.keys(pending).length === 0) return;

  const npcs = s.NPC;

  for (const [targetKey, impressions] of Object.entries(pending)) {
    for (const imp of impressions) {
      const covert = imp.可见性 === '隐秘';
      const targetLoc = npcs[targetKey]?.位置 ?? '';

      // 一跳：目标所在地点的在场 NPC（不含目标自身）
      const presentKeys = targetLoc
        ? Object.entries(npcs)
          .filter(([k, npc]) => k !== targetKey && npc.位置 === targetLoc)
          .map(([k]) => k)
        : [];

      for (const obs1 of presentKeys) {
        if (covert) continue; // covert 走 fact 自带门，一跳/二跳均不落印象

        writeImpressionMax(s.认知档案, obs1, targetKey, {
          标签:      imp.标签,
          极性:      imp.极性,
          强度:      imp.强度,
          来源:      `tick:${imp.来源拍号}`,
          获知时间:  nowEpochMin,
          衰减速率:  0,
          来源类型:  '一手观测' as const,
        });

        // 二跳：一跳观察者的 关系 连接（不在场）
        const obs1Npc = npcs[obs1];
        if (!obs1Npc) continue;
        for (const rel of obs1Npc.关系) {
          const obs2 = rel.对象键;
          if (!obs2 || obs2 === targetKey || presentKeys.includes(obs2)) continue;
          const strength2 = imp.强度 * RIPPLE_DECAY * (rel.信任 / 100);
          if (strength2 < RIPPLE_MIN) continue;
          writeImpressionMax(s.认知档案, obs2, targetKey, {
            标签:      imp.标签,
            极性:      imp.极性,
            强度:      strength2,
            来源:      `听闻自:${obs1}`,
            获知时间:  nowEpochMin,
            衰减速率:  0,
            来源类型:  '二手转述' as const,
          });
        }
      }
    }
  }

  // 清空已处理的涟漪候选
  s.$涟漪候选 = {};
}

// ── 涟漪发射工具（G1a·Phase 6 接线点 / 外部调用方接口） ────────────────────────

/** $涟漪候选 条目形状（与 $涟漪候选Schema 元素对齐）*/
type RippleEntry = {
  标签: string; 极性: string; 强度: number;
  可见性: string; 来源拍号: number;
};

/**
 * 向 $涟漪候选 缓冲追加一条候选条目。
 * Phase 6 (关系触发) 和外部调用方（server.ts 动作处理）均可通过此接口发射。
 * 纯本地副作用：仅写传入的 pending 对象（runTick structuredClone 隔离）。
 */
export function emitRipple(
  pending: RootState['$涟漪候选'],
  targetKey: string,
  entry: RippleEntry,
): void {
  const bucket = pending[targetKey];
  if (bucket) {
    bucket.push(entry);
  } else {
    pending[targetKey] = [entry];
  }
}

// ── 印象写入（取 max·防环） ────────────────────────────────────────────────────

type ImpressionEntry = {
  标签: string; 极性: string; 强度: number;
  来源: string; 获知时间: number; 衰减速率: number;
  来源类型: '一手观测' | '二手转述' | '玩家陈述';
};

function writeImpressionMax(
  认知: RootState['认知档案'],
  observerKey: string,
  targetKey: string,
  entry: ImpressionEntry,
): void {
  if (!认知[observerKey]) 认知[observerKey] = {};
  if (!认知[observerKey]![targetKey]) {
    认知[observerKey]![targetKey] = { 了解度: 0, 误差表: {}, 印象: [], 时效: 0, 姓名知识: '已知姓名' };
  }
  const 印象 = 认知[observerKey]![targetKey]!.印象;
  const existing = 印象.find(i => i.标签 === entry.标签 && i.极性 === entry.极性);
  if (existing) {
    // 取 max 防循环膨胀
    if (entry.强度 > existing.强度) {
      existing.强度    = entry.强度;
      existing.来源    = entry.来源;
      existing.获知时间 = entry.获知时间;
    }
  } else {
    印象.push(entry);
  }
}
