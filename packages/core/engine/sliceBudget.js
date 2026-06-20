// P0-8 Batch 3: 切片预算 B1–B6 四级供给阶梯
// 组装侧·切片降级不进指纹（R7-b 组装律·与确定性判定层解耦）

/** 降级优先级（靠前=先降·低优先级先截）- 拍板③铁律 */
export const DEGRADATION_ORDER = ['lore', 'nearK', 'chronicle'];
/**
 * 粗估 token 数。
 * CJK / 假名 / 全角约 1 char/token；ASCII / 标点约 0.25 char/token。
 */
export function estimateTokens(text) {
    let count = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        if ((code >= 0x4E00 && code <= 0x9FFF) ||
            (code >= 0x3000 && code <= 0x303F) ||
            (code >= 0x3040 && code <= 0x30FF) ||
            (code >= 0xFF00 && code <= 0xFFEF) ||
            (code >= 0x2E80 && code <= 0x2EFF)) {
            count += 1;
        }
        else {
            count += 0.25;
        }
    }
    return Math.ceil(count);
}
/**
 * 计算切片部件列表总 token 数。
 */
export function estimateSliceTokens(parts) {
    return parts.reduce((sum, p) => sum + estimateTokens(p.content), 0);
}
/**
 * 按超限降级顺序裁剪切片部件（B1–B6 四级供给阶梯）。
 *
 * 降级顺序（拍板③铁律）: lore谓词 → 近K历史 → 编年史
 * 不进指纹（组装律·R7-b）：返回值仅用于叙事注入·禁传入 hashPresetFingerprint。
 */
export function applySliceBudget(parts, budget) {
    let current = [...parts];
    const degradedKeys = [];
    for (const key of DEGRADATION_ORDER) {
        if (estimateSliceTokens(current) <= budget.softLimitTokens) break;
        if (key === 'lore') {
            const before = current.length;
            current = current.filter(p => p.key !== 'lore');
            if (current.length < before) degradedKeys.push('lore');
        }
        else if (key === 'nearK') {
            const idx = current.findIndex(p => p.key === 'nearK');
            if (idx >= 0) {
                const orig = current[idx];
                const lines = orig.content.split('\n').filter(l => l.length > 0);
                const keep = Math.max(1, Math.floor(lines.length / 2));
                if (keep < lines.length) {
                    current = [
                        ...current.slice(0, idx),
                        { key: 'nearK', content: lines.slice(-keep).join('\n') },
                        ...current.slice(idx + 1),
                    ];
                    degradedKeys.push('nearK');
                }
            }
        }
        else if (key === 'chronicle') {
            const before = current.length;
            current = current.filter(p => p.key !== 'chronicle');
            if (current.length < before) degradedKeys.push('chronicle');
        }
    }
    return { parts: current, degradedKeys };
}
