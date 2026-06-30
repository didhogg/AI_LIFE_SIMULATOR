// B4 · 内容包集聚合哈希层（批③ deferred stub 实装 · 接 acd5f07）
//
// 永久契约（拍板 2026-06-17）：
//   入口 = 全部已启用包集合（mod／事件包／战术包／补丁集／纪元包／effect 包·各带 content_hash）
//   输出 = 该集合的聚合内容哈希串，喂 hashPresetFingerprint 的「生效中内容包集哈希」member
//   fail-open：空集合 → 确定性占位空串 ''（黄金向量 5c1d0233/63b3e729/db10d5c7 不重生成）
//   算法：各包 content_hash 去重排序（Unicode 码点序·禁 localeCompare）→ canonicalize → fnv1a32 → 8字符 hex
//
// 红线：本文件绝不被 rng.ts/hashPresetFingerprint import（grep 证零接线）
// B6 defer：活线接入 hashPresetFingerprint 调用点·五道闸·registerEffectPack·RootSchema 挂载
import { fnv1a32 } from '../engine/text/fnv1a32.js';
import { canonicalize } from '../engine/text/canonicalize.js';
/**
 * 聚合全部已启用包的 content_hash，产出「生效中内容包集哈希」。
 * 空集合或全部 content_hash 缺失 → '' (fail-open 确定性占位)。
 */
export function 聚合生效中内容包集哈希(packs) {
    const hashes = [
        ...new Set(packs
            .map(p => p.content_hash)
            .filter((h) => typeof h === 'string' && h.length > 0)),
    ].sort(); // Unicode 码点序，禁 localeCompare
    if (hashes.length === 0)
        return '';
    return fnv1a32(canonicalize(hashes)).toString(16).padStart(8, '0');
}
/**
 * 计算单个包的 content_hash（去除包自身的 content_hash 字段后哈希）。
 * 纯函数·确定性·无副作用。B6 消费时传入具体包类型。
 */
export function computeEffectPackHash(pack) {
    const rest = {};
    for (const key of Object.keys(pack)) {
        if (key !== 'content_hash')
            rest[key] = pack[key];
    }
    return fnv1a32(canonicalize(rest)).toString(16).padStart(8, '0');
}
