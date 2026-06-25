// PR-瘦身-A2 · resolve() 双轨并存 + 三层校验
// PR-瘦身-底座-2b · 规则库路径接线（rules 字段·规则成品·生效中规则集）
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
        // 种子视图 passthrough → 解析结果与输入逐位恒等（幂等·断言⑤）
        const seedSchema = 种子视图(shape[k]);
        const parsed = seedSchema.safeParse(v);
        const value = parsed.success ? parsed.data : v;
        result = deepMerge(result, { [k]: value });
    }
    return result;
}
// ── 三层校验 + 双轨 resolve ──────────────────────────────────────────────────────
export function resolve(manifest, library, ruleLib) {
    const BASE_VERSION = manifest.基底版本 ?? '4.1.0';
    const 墓碑库 = {};
    // ── Layer 1: 单包校验 ────────────────────────────────────────────────────────
    const registry = {};
    for (let i = 0; i < manifest.packs.length; i++) {
        const packId = manifest.packs[i];
        const pack = library[packId];
        if (!pack)
            continue;
        // key === pack_id（对齐 memory.ts:342 mod注册表 superRefine）
        if (pack.pack_id !== packId) {
            墓碑库[packId] = {
                记录键: packId,
                pack_id: pack.pack_id,
                原因: 'key不等pack_id',
                诊断: `library key "${packId}" ≠ pack_id "${pack.pack_id}"`,
            };
            continue;
        }
        // 基底契约 semver（仅当字段有值时校验）
        const 基底契约 = pack.基底契约;
        if (基底契约 && 基底契约 !== '') {
            let semverOk = false;
            try {
                semverOk = satisfies(BASE_VERSION, 基底契约);
            }
            catch {
                semverOk = false;
            }
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
        // 轨道一致性：轻轨禁带可写键（对齐 memory.ts:328 mod条目 superRefine）
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
    for (const key of loadResult.graph.selfLoops) {
        if (!墓碑库[key]) {
            const pid = registry[key]?.pack_id;
            墓碑库[key] = pid !== undefined
                ? { 记录键: key, pack_id: pid, 原因: '自环' }
                : { 记录键: key, 原因: '自环' };
        }
    }
    for (const key of loadResult.rejected) {
        if (!墓碑库[key]) {
            const pid = registry[key]?.pack_id;
            墓碑库[key] = pid !== undefined
                ? { 记录键: key, pack_id: pid, 原因: '依赖被拒' }
                : { 记录键: key, 原因: '依赖被拒' };
        }
    }
    for (const conflict of loadResult.conflicts) {
        if (!墓碑库[conflict.b]) {
            const pid = registry[conflict.b]?.pack_id;
            const base = { 记录键: conflict.b, 原因: '冲突', 诊断: `与「${conflict.a}」冲突` };
            墓碑库[conflict.b] = pid !== undefined ? { ...base, pack_id: pid } : base;
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
    // Layer 3 最终：聚合生效中内容包集哈希（喂 hashPresetFingerprint）
    const 生效中内容包集哈希 = 聚合生效中内容包集哈希(生效中包集.map(p => p.内容哈希 !== undefined ? { content_hash: p.内容哈希 } : {}));
    // ── 规则库路径（底座-2b）────────────────────────────────────────────────────
    let 规则成品 = {};
    const 生效中规则集 = [];
    const _规则墓碑库 = {};
    if (ruleLib && manifest.rules && manifest.rules.length > 0) {
        // ── 规则 Layer 1: 单条目校验 ─────────────────────────────────────────────
        const ruleRegistry = {};
        for (let i = 0; i < manifest.rules.length; i++) {
            const ruleId = manifest.rules[i];
            const rule = ruleLib[ruleId];
            if (!rule)
                continue;
            if (rule.rule_id !== ruleId) {
                _规则墓碑库[ruleId] = {
                    记录键: ruleId,
                    pack_id: rule.rule_id,
                    原因: 'key不等pack_id',
                    诊断: `library key "${ruleId}" ≠ rule_id "${rule.rule_id}"`,
                };
                continue;
            }
            const 基底契约r = rule.基底契约;
            if (基底契约r && 基底契约r !== '') {
                let ok = false;
                try {
                    ok = satisfies(BASE_VERSION, 基底契约r);
                }
                catch {
                    ok = false;
                }
                if (!ok) {
                    _规则墓碑库[ruleId] = {
                        记录键: ruleId,
                        pack_id: rule.rule_id,
                        原因: 'semver不兼容',
                        诊断: `基底契约「${基底契约r}」与当前版本「${BASE_VERSION}」不兼容`,
                    };
                    continue;
                }
            }
            const 轨道r = rule.轨道;
            const 可写键r = rule.可写键;
            if (轨道r && 轨道r !== 'gameplay' && (可写键r?.length ?? 0) > 0) {
                _规则墓碑库[ruleId] = {
                    记录键: ruleId,
                    pack_id: rule.rule_id,
                    原因: '其他',
                    诊断: `轨道「${轨道r}」为轻轨，禁带可写键`,
                };
                continue;
            }
            ruleRegistry[ruleId] = {
                依赖: rule.依赖,
                pack_id: rule.rule_id,
                启用: true,
                优先级: i,
                冲突: rule.冲突 ?? [],
            };
        }
        // ── 规则 Layer 2: 跨条目校验 ─────────────────────────────────────────────
        const ruleLoadResult = computeLoadOrder(ruleRegistry);
        for (const key of ruleLoadResult.graph.selfLoops) {
            if (!_规则墓碑库[key]) {
                const pid = ruleRegistry[key]?.pack_id;
                _规则墓碑库[key] = pid !== undefined
                    ? { 记录键: key, pack_id: pid, 原因: '自环' }
                    : { 记录键: key, 原因: '自环' };
            }
        }
        for (const key of ruleLoadResult.rejected) {
            if (!_规则墓碑库[key]) {
                const pid = ruleRegistry[key]?.pack_id;
                _规则墓碑库[key] = pid !== undefined
                    ? { 记录键: key, pack_id: pid, 原因: '依赖被拒' }
                    : { 记录键: key, 原因: '依赖被拒' };
            }
        }
        for (const conflict of ruleLoadResult.conflicts) {
            if (!_规则墓碑库[conflict.b]) {
                const pid = ruleRegistry[conflict.b]?.pack_id;
                const base = { 记录键: conflict.b, 原因: '冲突', 诊断: `与「${conflict.a}」冲突` };
                _规则墓碑库[conflict.b] = pid !== undefined ? { ...base, pack_id: pid } : base;
            }
        }
        // ── 规则 Layer 3: 规则面叠加 → 规则成品 ──────────────────────────────────
        for (const ruleId of ruleLoadResult.flattenedLoadOrder) {
            if (_规则墓碑库[ruleId])
                continue;
            const rule = ruleLib[ruleId];
            if (!rule)
                continue;
            if (rule.规则面) {
                规则成品 = deepMerge(规则成品, rule.规则面);
            }
            生效中规则集.push(rule);
        }
    }
    return { 成品, _mod墓碑库: 墓碑库, 生效中包集, 生效中内容包集哈希, 规则成品, 生效中规则集, _规则墓碑库 };
}
