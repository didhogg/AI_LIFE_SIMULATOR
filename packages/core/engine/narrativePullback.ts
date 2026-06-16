// N-5: 正剧拉回 × 场景检测器时点分离
// T1 (pre-pullback): recentDensity → 计算是否触发拉回
// T2 (post-pullback): finalIntentTags → 供场景检测器（isNsfwScene）读取
// 两读点显式分时点，类型签名强制隔离，禁止互相回灌

export const PULLBACK_DENSITY_THRESHOLD = 0.7 as const;

export interface PullbackResult {
  /** T2: 拉回后标签——场景检测器仅读此字段，不读 T1 密度 */
  finalIntentTags: string[];
  appliedPullback: boolean;
}

/**
 * 从 T1（近期密度）计算 T2（拉回后意图标签）。
 * 参数设计强制时点分离：T2 由本函数产生，绝不作为输入回灌。
 */
export function computeNarrativePullback(
  recentDensity: number,          // T1: 拉回前近期密度 [0, 1]
  originalIntentTags: string[],   // 拉回前意图标签（本函数输入）
): PullbackResult {
  if (recentDensity <= PULLBACK_DENSITY_THRESHOLD) {
    return { finalIntentTags: originalIntentTags, appliedPullback: false };
  }
  // 拉回: 移除强 NSFW/explicit 标签，添加 pullback 标记（正剧化叙事）
  const adjusted = [
    ...originalIntentTags.filter(t => !t.includes('nsfw') && !t.includes('explicit')),
    'pullback',
  ];
  return { finalIntentTags: adjusted, appliedPullback: true };
}
