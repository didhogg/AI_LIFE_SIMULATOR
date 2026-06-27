// PR-2: LOD 实体化 + 新闻纯认知层
// 纯函数·确定性·Ring 0·禁 Date.now/Math.random/localeCompare/裸JSON.stringify/NFC
//
// P2-2  materializeCoarseNode  — 粗节点 → 全 NPC（seeded·幂等）
// P2-3  newsToCognition        — 新闻 → 认知档案（硬断言：不创建实体）
// P2-4  triggerLodGate         — POV 接触粗节点 → materialize（拍内去重）
//
// 红线：rng.ts/gate.ts/conservation.ts/computeDelta.ts/fixed.ts 函数体零 diff。
// schemaKeys=52 守恒（不新增顶层 key）。

import type { RootState } from '../schema/index.js';
import { rngFor } from './rng.js';
import { writeImpressionMax, CHRONICLE_PUBLIC_THRESHOLD, type ImpressionEntry } from './tick.js';

// ── 四元盐：seed·tick=0·channel·rerollSalt=0
// tick=0: 粗节点实体化与拍号无关（幂等·跨存档一致）
// rerollSalt=0: 基础属性不随普通重掷变化
function lodRng(seed: number, nodeKey: string, attr: string): number {
  return rngFor(seed, 0, `lod:materialize:${nodeKey}:${attr}`, 0);
}

// 将 [0,99] 映射到 [lo, hi]（整数·含端点）
function mapRange(v: number, lo: number, hi: number): number {
  return lo + Math.round((v / 99) * (hi - lo));
}

// ── P2-2: materializeCoarseNode ───────────────────────────────────────────────

/**
 * 粗节点属性实体化（纯 in-place 变更·调用方须已 structuredClone）。
 * - node 不存在 → no-op
 * - 用 rngFor 四元盐派生缺省属性（确定性·禁 Math.random）
 * - LOD-B4b: LOD档位 已迁至 LOD表·本函数不再读写 LOD状态·由调用方写 LOD表[npcKey].档位
 */
export function materializeCoarseNode(
  s: RootState,
  nodeKey: string,
  seed: number,
): void {
  const node = s.NPC[nodeKey];
  if (!node) return;

  // 派生缺省属性（体质/智慧/感知/魅力/心理 → [20,60] 中段范围）
  node.属性.体质 = mapRange(lodRng(seed, nodeKey, '体质'), 20, 60);
  node.属性.智慧 = mapRange(lodRng(seed, nodeKey, '智慧'), 20, 60);
  node.属性.感知 = mapRange(lodRng(seed, nodeKey, '感知'), 20, 60);
  node.属性.魅力 = mapRange(lodRng(seed, nodeKey, '魅力'), 20, 60);
  node.属性.心理 = mapRange(lodRng(seed, nodeKey, '心理'), 20, 60);
}

// ── P2-3: newsToCognition ─────────────────────────────────────────────────────

export interface NewsEntry {
  /** 新闻主体实体键（可为粗节点键·但不实体化）*/
  主体: string;
  /** 印象标签 */
  标签: string;
  /** 极性 '正'|'负' */
  极性: string;
  /** 印象强度 [0,100] */
  强度: number;
  /** factFragment 维度 */
  维度: string;
  /** factFragment 方向 +1/-1 */
  Δ方向: number;
  /** factFragment 量级 [0,100] */
  量级: number;
  /** 来源标识（事件id / 媒体渠道键） */
  来源: string;
}

/**
 * 新闻纯认知层写入（in-place·调用方须已 structuredClone）。
 *
 * 约束（硬断言）：
 *   - 不创建任何新 NPC 条目
 *   - 不修改任何 NPC 的 LOD档位
 *   - 只写 认知档案；不调用 materializeCoarseNode
 *
 * 来源类型固定为 '二手转述'（新闻非直接观测）。
 * 只向已存在的全实体 NPC（LOD档位 !== '粗'）写入；粗节点观察者跳过。
 */
export function newsToCognition(
  s: RootState,
  news: NewsEntry,
  observers: readonly string[],
  nowEpochMin: number,
): void {
  const npcCountBefore = Object.keys(s.NPC).length;

  const entry: ImpressionEntry = {
    标签: news.标签,
    极性: news.极性,
    强度: news.强度,
    来源: news.来源,
    获知时间: nowEpochMin,
    衰减速率: 0,
    来源类型: '二手转述',
    factFragment: {
      主体: news.主体,
      维度: news.维度,
      Δ方向: news.Δ方向,
      量级: news.量级,
    },
  };

  for (const observerKey of observers) {
    const observer = s.NPC[observerKey];
    // 跳过不存在或仍为粗节点的观察者（粗节点无完整认知层）
    if (!observer || s.LOD表[observerKey]?.档位 === '粗') continue;
    writeImpressionMax(s.认知档案, observerKey, news.主体, entry);
  }

  // 硬断言：不得创建实体
  if (Object.keys(s.NPC).length !== npcCountBefore) {
    throw new Error('[PR-2] newsToCognition: violated no-materialization guarantee');
  }
}

// ── P2-4: triggerLodGate ──────────────────────────────────────────────────────

/**
 * 实体化触发闸（in-place·调用方须已 structuredClone）。
 * - 遍历 contactKeys：若 LOD表[key].档位==='粗' → materializeCoarseNode + 写 LOD表
 * - 同拍同节点只实体化一次（Set 去重）
 * - 无接触 / 已实体化 / 无 LOD表 条目 → no-op
 */
export function triggerLodGate(
  s: RootState,
  contactKeys: readonly string[],
  seed: number,
): void {
  const done = new Set<string>();
  for (const key of contactKeys) {
    if (done.has(key)) continue;
    done.add(key);
    if (s.LOD表[key]?.档位 !== '粗') continue;
    materializeCoarseNode(s, key, seed);
    s.LOD表[key]!.档位 = '实体';
  }
}

// ── 辅助：判断 NPC 是否为粗节点（LOD-B4b: 读 LOD表·不读 NPC.LOD档位）──────────
export function isCoarseNode(s: RootState, key: string): boolean {
  return s.LOD表[key]?.档位 === '粗';
}

// ── 辅助：计算新闻量级是否达到公共知识阈值 ────────────────────────────────────
export const NEWS_CHRONICLE_THRESHOLD = CHRONICLE_PUBLIC_THRESHOLD;
