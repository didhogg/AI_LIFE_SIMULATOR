/* eslint-disable @typescript-eslint/no-unused-vars */
// 焊死前批③ 深度 A · 聚合函数签名 stub（未接线·实装留 P0-6）
//
// 永久契约（拍板 2026-06-17）：
//   入口 = 全部已启用包集合（mod／事件包／战术包／补丁集／纪元包／effect 包·各带 content_hash）
//   输出 = 该集合的聚合内容哈希串，喂 hashPresetFingerprint 的「生效中内容包集哈希」member
//   fail-open：空集合 → 确定性占位空串 ''（黄金向量 5c1d0233/63b3e729/db10d5c7 不重生成）
//   算法 body／canonicalize／fnv1a32／接 hashPresetFingerprint 一律留 P0-6·本文件绝不实装
//
// 红线：本文件绝不被 rng.ts/hashPresetFingerprint import（grep 证零接线）

/** 本步占位形状·真类型 P0-6 绑定（届时对齐 intervention_pack_v1Schema 等实际包类型） */
type 已启用包集合 = ReadonlyArray<{ readonly content_hash?: string }>;

/**
 * 聚合全部已启用包的 content_hash，产出「生效中内容包集哈希」。
 * 未实装·签名 stub·留 P0-6 接线。
 */
export function 聚合生效中内容包集哈希(_已启用包集合: 已启用包集合): string {
  throw new Error('聚合生效中内容包集哈希：未接线·留 P0-6（焊死前批③ 仅签名 stub）');
}
