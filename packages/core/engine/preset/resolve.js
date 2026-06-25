// PR-瘦身-A2 · resolve() 双轨并存 + 三层校验
// 新轨（模块键路由 + 内容包库）优先；旧轨（直接叠加）作等价验收基准
// dormant: 不接 runTick · 不进生产路径 · 纯函数·无副作用
// 禁 Date.now / new Date / Math.random / window / document
import { computeLoadOrder } from '../../loader/modGraph.js';
import { satisfies } from '../../loader/semver.js';
import { 聚合生效中内容包集哈希 } from '../../interfaces/contentPackHash.js';
import { 种子视图 } from './seedView.js';
import { RootSchema } from '../../schema/index.js';
// ── 确定性深合并（无 Date/random/副作用·对象递归展开·数组/叶节点后载覆盖） ───
function deepMerge(base, next) {
    if (typeof base === 'object' && base !== null && !Array.isArray(base) &&
        typeof next === 'object' && next !== null && !Array.isArray(next)) {
        const result = { ...base };
        for (const [k, v] of Object.entries(next)) {
            result[k] = k in result ? deepMerge(result[k], v) : v;
        }
        return result;
    }
    return next;
}
// ── 旧轨叠加（不走 种子视图·直接 deep merge·双轨等价验收基准） ─────────────────
export function 旧轨叠加(base, 新数据) {
    if (!新数据)
        return { ...base };
    return deepMerge(base, 新数据);
}
// ── 新轨叠加（经 种子视图 解析后 deep merge·0 default 污染·与旧轨等价） ─────────
function 新轨叠加(base, 模块种子) {
    const shape = RootSchema.shape;
    let result = { ...base };
    for (const [k, v] of Object.entries(模块种子)) {
        if (!(k in shape))
            continue;
        const seedSchema = 种子视图(shape[k]);
        const parsed = seedSchema.safeParse(v);
        const value = parsed.success ? parsed.data : v;
        result = deepMerge(result, { [k]: value });
    }
    return result;
}
// ── 三层校验 + 双轨 resolve ──────────────────────────────────────────────────────
export function resolve(manifest, library) {
    const BASE_VERSION = manifest.基底版本 ?? '4.1.0';
    const 墓碑库 = {};
    // ── Layer 1: 单包校验 ────────────────────────────────────────────────────────
    const registry = {};
    for (let i = 0; i < manifest.packs.length; i++) {
        const packId = manifest.packs[i];
        const pack = library[packId];
        if (!pack)
            continue;
        // key === pack_id
        if (pack.pack_id !== packId) {
            墓碑库[packId] = {
                记录键: packId,
                pack_id: pack.pack_id,
                原因: 'key不等pack_id',
                诊断: `library key "${packId}" ≠ pack_id "${pack.pack_id}"`,
            };
            continue;
        }
        // 基底契约 semver
        const 基底契约 = pack.基底契约;
        if (基底契约 && 基底契约 !== '') {
            let semverOk = false;
            try {
                semverOk = satisfies(BASE_VERSION, 基底契约);
            }
            catch { semverOk = false; }
            if (!semverOk) {
                墓碑库[packId] = {
                    记录键: packId,
                    pack_id: pack.pack_id,
                    原因: 'semver不兼容',
                    诊断: `基底契约「${基底契约}」与当前版本「${BASE_VERSION}」不兼容`,
                };
                continue;
            }
        }
        // 轨道一致性：轻轨禁带可写键
        const 轨道 = pack.轨道;
        const 可写键 = pack.可写键;
        if (轨道 && 轨道 !== 'gameplay' && (可写键?.length ?? 0) > 0) {
            墓碑库[packId] = {
                记录键: packId,
                pack_id: pack.pack_id,
                原因: '其他',
                诊断: `轨道「${轨道}」为轻轨，禁带可写键`,
            };
            continue;
        }
        registry[packId] = {
            依赖: pack.依赖,
            pack_id: pack.pack_id,
            启用: true,
            优先级: i,
            冲突: pack.冲突 ?? [],
        };
    }
    // ── Layer 2: 跨包校验（computeLoadOrder） ───────────────────────────────────
    const loadResult = computeLoadOrder(registry);
    // 自环 → 墓碑
    for (const key of loadResult.graph.selfLoops) {
        if (!墓碑库[key]) {
            墓碑库[key] = { 记录键: key, pack_id: registry[key]?.pack_id, 原因: '自环' };
        }
    }
    // 依赖被拒（级联）→ 墓碑
    for (const key of loadResult.rejected) {
        if (!墓碑库[key]) {
            墓碑库[key] = { 记录键: key, pack_id: registry[key]?.pack_id, 原因: '依赖被拒' };
        }
    }
    // 冲突 → 后者（b 端）入墓碑
    for (const conflict of loadResult.conflicts) {
        if (!墓碑库[conflict.b]) {
            墓碑库[conflict.b] = {
                记录键: conflict.b,
                pack_id: registry[conflict.b]?.pack_id,
                原因: '冲突',
                诊断: `与「${conflict.a}」冲突`,
            };
        }
    }
    // ── Layer 3: 新轨叠加 → canonical 成品 ──────────────────────────────────────
    let 成品 = {};
    const 生效中包集 = [];
    for (const packId of loadResult.flattenedLoadOrder) {
        if (墓碑库[packId])
            continue;
        const pack = library[packId];
        if (!pack)
            continue;
        if (pack.模块种子) {
            成品 = 新轨叠加(成品, pack.模块种子);
        }
        生效中包集.push(pack);
    }
    // Layer 3 最终：聚合生效中内容包集哈希
    const 生效中内容包集哈希 = 聚合生效中内容包集哈希(生效中包集.map(p => ({ content_hash: p.内容哈希 })));
    return { 成品, _mod墓碑库: 墓碑库, 生效中包集, 生效中内容包集哈希 };
}
