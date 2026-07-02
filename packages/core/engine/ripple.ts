// 涟漪四纯净件（前置③·从 tick.ts 原样搬入，行为 diff=0）
// propagateRipple 及其六个私有依赖函数留守 tick.ts，本文件不碰。
import type { RootState } from '../schema/index.js';

// ── 涟漪发射工具（G1a·Phase 6 接线点 / 外部调用方接口） ────────────────────────

/** $涟漪候选 条目形状（与 $涟漪候选Schema 元素对齐·C2-0/G2-3 additive 同步） */
export type RippleEntry = {
  标签: string; 极性: string; 强度: number;
  可见性: string; 来源拍号: number;
  矫诏?: boolean;         // G2-3 S2: 伪诏标志（true=官方信道走伪路径·未声明=退回旧行为）
  factFragment?: {
    主体: string; 维度: string; Δ方向: number;
    客体?: string; 场景?: string; 量级: number;
    narrativeFrame?: string;
  };
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

export type ImpressionEntry = {
  标签: string; 极性: string; 强度: number;
  来源: string; 获知时间: number; 衰减速率: number;
  来源类型: '一手观测' | '二手转述' | '玩家陈述';
  // C2-3 factFragment 载荷（additive·optional·T1 认知投影层接线）
  factFragment?: {
    主体: string; 维度: string; Δ方向: number;
    客体?: string | undefined; 场景?: string | undefined; 量级: number;
    narrativeFrame?: string | undefined;
  };
};

export function writeImpressionMax(
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
    // 取 max 防循环膨胀；更新 factFragment（若有）
    if (entry.强度 > existing.强度) {
      existing.强度    = entry.强度;
      existing.来源    = entry.来源;
      existing.获知时间 = entry.获知时间;
      if (entry.factFragment !== undefined) existing.factFragment = entry.factFragment;
    }
  } else {
    印象.push(entry);
  }
}
