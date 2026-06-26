// PR-瘦身-A2 · resolve() 双轨并存 + 三层校验
// PR-瘦身-底座-2b · 规则库路径接线（rules 字段·规则成品·生效中规则集）
// PR-瘦身-底座-5 · 阶段C 转正（生产路径·含 shimThickPreset 兼容 shim）
// PR-瘦身-剥离③ · 7 冰箱路径 + 5 裸标量聚合（additive · dormant）
// 新轨（模块键路由 + 内容包库）优先；旧轨（直接叠加）作等价验收基准
// 纯函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { computeLoadOrder } from '../../loader/modGraph.js';
import { satisfies } from '../../loader/semver.js';
import { 聚合生效中内容包集哈希 } from '../../interfaces/contentPackHash.js';
// 剥离③ 裸标量类型（dormant·optional·unknown·test 侧验具体形态）
import { 种子视图 } from './seedView.js';
import { RootSchema } from '../../schema/index.js';
import { 是JS保留键 } from '../../schema/governedKeySpace.js';
// ── 确定性深合并（无 Date/random/副作用·对象递归展开·数组/叶节点后载覆盖） ───
function deepMerge(base, next) {
    if (typeof base === 'object' && base !== null && !Array.isArray(base) &&
        typeof next === 'object' && next !== null && !Array.isArray(next)) {
        const result = { ...base };
        for (const [k, v] of Object.entries(next)) {
            if (是JS保留键(k))
                continue;
            result[k] = k in result ? deepMerge(result[k], v) : v;
        }
        return result;
    }
    return next; // 数组/叶节点：后载覆盖先载
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
/**
 * resolve(薄清单, 内容包库) → 解析结果
 *
 * 三层校验：
 *   ① 单包（拼装前）：key===pack_id · 基底契约 semver · 轨道一致性（轻轨禁可写键）
 *   ② 拼装（跨包）：computeLoadOrder → 自环/依赖被拒/冲突 → 确定性进墓碑库
 *   ③ 成品（拼装后）：聚合生效中内容包集哈希 → 可直接喂 hashPresetFingerprint
 *
 * 新轨（模块键路由·种子视图解析）优先；旧轨叠加()提供等价基准供双轨验收。
 */
export function resolve(manifest, library, ruleLib, uiLib, toolLib, achLib, itemLib, mediaLib, academicLib, rankLib, entityTplLib, styleLib, reviewDimLib, stageScriptLib, optionSetLib, 
// 剥离③ 新增（additive · dormant）
raceTemplateLib, tacticPackLib, narrativeDistLib, motifVocabLib, motifQuotaLib, offstageContractLib, socialRoleLib) {
    const BASE_VERSION = manifest.基底版本 ?? '4.1.0';
    const 墓碑库 = {};
    // ── Layer 1: 单包校验 ────────────────────────────────────────────────────────
    const registry = {};
    for (let i = 0; i < manifest.packs.length; i++) {
        const packId = manifest.packs[i];
        const pack = library[packId];
        if (!pack)
            continue; // 不在库中 → 静默跳过（不入墓碑·后续 computeLoadOrder 处理悬空依赖）
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
            优先级: i, // manifest 位置 = 优先级（后列覆盖先列·后载覆盖先载）
            冲突: pack.冲突 ?? [],
        };
    }
    // ── Layer 2: 跨包校验（computeLoadOrder） ───────────────────────────────────
    const loadResult = computeLoadOrder(registry);
    // 自环 → 墓碑（exactOptionalPropertyTypes：pack_id 仅在已知时写入）
    for (const key of loadResult.graph.selfLoops) {
        if (!墓碑库[key]) {
            const pid = registry[key]?.pack_id;
            墓碑库[key] = pid !== undefined
                ? { 记录键: key, pack_id: pid, 原因: '自环' }
                : { 记录键: key, 原因: '自环' };
        }
    }
    // 依赖被拒（级联）→ 墓碑
    for (const key of loadResult.rejected) {
        if (!墓碑库[key]) {
            const pid = registry[key]?.pack_id;
            墓碑库[key] = pid !== undefined
                ? { 记录键: key, pack_id: pid, 原因: '依赖被拒' }
                : { 记录键: key, 原因: '依赖被拒' };
        }
    }
    // 冲突 → 后者（b 端）入墓碑（codepoint-larger key 失败）
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
    // 仅传入有值的条目（exactOptionalPropertyTypes 不允许 content_hash: undefined）
    const 生效中内容包集哈希 = 聚合生效中内容包集哈希(生效中包集.map(p => p.内容哈希 !== undefined ? { content_hash: p.内容哈希 } : {}));
    // ── 规则库路径（底座-2b）————————————————————————————————————————————————————
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
            // key === rule_id（对齐 内容包库 key===pack_id 语义）
            if (rule.rule_id !== ruleId) {
                _规则墓碑库[ruleId] = {
                    记录键: ruleId,
                    pack_id: rule.rule_id,
                    原因: 'key不等pack_id',
                    诊断: `library key "${ruleId}" ≠ rule_id "${rule.rule_id}"`,
                };
                continue;
            }
            // 基底契约 semver
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
            // 轨道一致性：轻轨禁带可写键
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
        // ── 规则 Layer 2: 跨条目校验（computeLoadOrder） ─────────────────────────
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
    // ── UI库路径 ─────────────────────────────────────────────────────────────────
    // BFS 展开：从 manifest.ui[] 出发，递归收集 子组件 IDs（自有属性 guard·防原型污染）
    // dormant：不进 hashJudgmentBundle·不进指纹·渲染面专用
    const UI成品 = {};
    const 生效中UI集 = [];
    const _UI墓碑库 = {};
    if (uiLib && manifest.ui && manifest.ui.length > 0) {
        const visited = new Set();
        const queue = [...manifest.ui];
        while (queue.length > 0) {
            const id = queue.shift();
            if (visited.has(id))
                continue;
            visited.add(id);
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(uiLib, id))
                continue;
            const entry = uiLib[id];
            if (!entry)
                continue;
            UI成品[id] = entry;
            生效中UI集.push(entry);
            // 子组件 BFS 展开（多层嵌套·无环保护由 visited Set 守卫）
            for (const childId of entry.子组件 ?? []) {
                if (!visited.has(childId))
                    queue.push(childId);
            }
        }
    }
    // ── 工具库路径 ──────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.tools 出发，按 工具ID 直接查 toolLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·路由面专用
    const 工具成品 = {};
    const 生效中工具集 = [];
    const _工具墓碑库 = {};
    if (toolLib && manifest.tools && manifest.tools.length > 0) {
        for (const toolId of manifest.tools) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(toolLib, toolId))
                continue;
            const entry = toolLib[toolId];
            if (!entry)
                continue;
            工具成品[toolId] = entry;
            生效中工具集.push(entry);
        }
    }
    // ── 成就库路径 ──────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.achievements 出发，按 成就ID 直接查 achLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用·解锁求值接线留 P0-6
    const 成就成品 = {};
    const 生效中成就集 = [];
    const _成就墓碑库 = {};
    if (achLib && manifest.achievements && manifest.achievements.length > 0) {
        for (const achId of manifest.achievements) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(achLib, achId))
                continue;
            const entry = achLib[achId];
            if (!entry)
                continue;
            成就成品[achId] = entry;
            生效中成就集.push(entry);
        }
    }
    // ── 物品库路径 ──────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.items 出发，按 物品ID 直接查 itemLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用·actor 端运行期实例不受影响
    const 物品成品 = {};
    const 生效中物品集 = [];
    const _物品墓碑库 = {};
    if (itemLib && manifest.items && manifest.items.length > 0) {
        for (const itemId of manifest.items) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(itemLib, itemId))
                continue;
            const entry = itemLib[itemId];
            if (!entry)
                continue;
            物品成品[itemId] = entry;
            生效中物品集.push(entry);
        }
    }
    // ── 媒体库路径 ──────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.media 出发，按 媒体ID 直接查 mediaLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·渲染面+传播面占位专用
    const 媒体成品 = {};
    const 生效中媒体集 = [];
    const _媒体墓碑库 = {};
    if (mediaLib && manifest.media && manifest.media.length > 0) {
        for (const mediaId of manifest.media) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(mediaLib, mediaId))
                continue;
            const entry = mediaLib[mediaId];
            if (!entry)
                continue;
            媒体成品[mediaId] = entry;
            生效中媒体集.push(entry);
        }
    }
    // ── 学业制式库路径 ────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.学业制式 出发，按 学业制式ID 直接查 academicLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用
    const 学业制式成品 = {};
    const 生效中学业制式集 = [];
    const _学业制式墓碑库 = {};
    if (academicLib && manifest.学业制式 && manifest.学业制式.length > 0) {
        for (const id of manifest.学业制式) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(academicLib, id))
                continue;
            const entry = academicLib[id];
            if (!entry)
                continue;
            学业制式成品[id] = entry;
            生效中学业制式集.push(entry);
        }
    }
    // ── 职级体系库路径 ────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.职级体系 出发，按 职级体系ID 直接查 rankLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用
    const 职级体系成品 = {};
    const 生效中职级体系集 = [];
    const _职级体系墓碑库 = {};
    if (rankLib && manifest.职级体系 && manifest.职级体系.length > 0) {
        for (const id of manifest.职级体系) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(rankLib, id))
                continue;
            const entry = rankLib[id];
            if (!entry)
                continue;
            职级体系成品[id] = entry;
            生效中职级体系集.push(entry);
        }
    }
    // ── 实体模板库路径 ────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.实体模板 出发，按 实体模板ID 直接查 entityTplLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·黑洞面（NPC/组织 opaque·无物品模板）
    const 实体模板成品 = {};
    const 生效中实体模板集 = [];
    const _实体模板墓碑库 = {};
    if (entityTplLib && manifest.实体模板 && manifest.实体模板.length > 0) {
        for (const id of manifest.实体模板) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(entityTplLib, id))
                continue;
            const entry = entityTplLib[id];
            if (!entry)
                continue;
            实体模板成品[id] = entry;
            生效中实体模板集.push(entry);
        }
    }
    // ── 文风库路径 ────────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.文风 出发，按 文风ID 直接查 styleLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·渲染面 opaque 专用
    const 文风成品 = {};
    const 生效中文风集 = [];
    const _文风墓碑库 = {};
    if (styleLib && manifest.文风 && manifest.文风.length > 0) {
        for (const id of manifest.文风) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(styleLib, id))
                continue;
            const entry = styleLib[id];
            if (!entry)
                continue;
            文风成品[id] = entry;
            生效中文风集.push(entry);
        }
    }
    // ── 二审维度库路径 ────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.二审维度 出发，按 二审维度ID 直接查 reviewDimLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·事实层（检测方式/越界类型 typed）
    const 二审维度成品 = {};
    const 生效中二审维度集 = [];
    const _二审维度墓碑库 = {};
    if (reviewDimLib && manifest.二审维度 && manifest.二审维度.length > 0) {
        for (const id of manifest.二审维度) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(reviewDimLib, id))
                continue;
            const entry = reviewDimLib[id];
            if (!entry)
                continue;
            二审维度成品[id] = entry;
            生效中二审维度集.push(entry);
        }
    }
    // ── 小剧场剧本库路径 ──────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.小剧场剧本 出发，按 小剧场剧本ID 直接查 stageScriptLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·渲染面 opaque 专用
    const 小剧场剧本成品 = {};
    const 生效中小剧场剧本集 = [];
    const _小剧场剧本墓碑库 = {};
    if (stageScriptLib && manifest.小剧场剧本 && manifest.小剧场剧本.length > 0) {
        for (const id of manifest.小剧场剧本) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(stageScriptLib, id))
                continue;
            const entry = stageScriptLib[id];
            if (!entry)
                continue;
            小剧场剧本成品[id] = entry;
            生效中小剧场剧本集.push(entry);
        }
    }
    // ── 选项集库路径 ──────────────────────────────────────────────────────────────────
    // by-ID 加载：从 manifest.选项集 出发，按 选项集ID 直接查 optionSetLib（无 BFS·无子组件）
    // dormant：不进 hashJudgmentBundle·不进指纹·动词选项条目 by-set 组织·调用方经 投影选项集库() 回填 动词选项集
    const 选项集成品 = {};
    const 生效中选项集集 = [];
    const _选项集墓碑库 = {};
    if (optionSetLib && manifest.选项集 && manifest.选项集.length > 0) {
        for (const id of manifest.选项集) {
            // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
            if (!Object.prototype.hasOwnProperty.call(optionSetLib, id))
                continue;
            const entry = optionSetLib[id];
            if (!entry)
                continue;
            选项集成品[id] = entry;
            生效中选项集集.push(entry);
        }
    }
    // ── 剥离③ 新增 by-ID 库路径（additive · dormant） ──────────────────────────────
    // ── 种族模板库路径 ─────────────────────────────────────────────────────────────────
    // 进 hashJudgmentBundle·调用方经 投影种族模板库() 回填 种族模板参数·dormant
    const 种族模板成品 = {};
    const 生效中种族模板集 = [];
    const _种族模板墓碑库 = {};
    if (raceTemplateLib && manifest.种族模板 && manifest.种族模板.length > 0) {
        for (const id of manifest.种族模板) {
            if (!Object.prototype.hasOwnProperty.call(raceTemplateLib, id))
                continue;
            const entry = raceTemplateLib[id];
            if (!entry)
                continue;
            种族模板成品[id] = entry;
            生效中种族模板集.push(entry);
        }
    }
    // ── 战术包库路径 ───────────────────────────────────────────────────────────────────
    // 不进 hashJudgmentBundle·dormant·战斗辅助
    const 战术包成品 = {};
    const 生效中战术包集 = [];
    const _战术包墓碑库 = {};
    if (tacticPackLib && manifest.战术包 && manifest.战术包.length > 0) {
        for (const id of manifest.战术包) {
            if (!Object.prototype.hasOwnProperty.call(tacticPackLib, id))
                continue;
            const entry = tacticPackLib[id];
            if (!entry)
                continue;
            战术包成品[id] = entry;
            生效中战术包集.push(entry);
        }
    }
    // ── 叙事分发库路径 ─────────────────────────────────────────────────────────────────
    // 不进 hashJudgmentBundle·dormant·叙事面
    const 叙事分发成品 = {};
    const 生效中叙事分发集 = [];
    const _叙事分发墓碑库 = {};
    if (narrativeDistLib && manifest.叙事分发 && manifest.叙事分发.length > 0) {
        for (const id of manifest.叙事分发) {
            if (!Object.prototype.hasOwnProperty.call(narrativeDistLib, id))
                continue;
            const entry = narrativeDistLib[id];
            if (!entry)
                continue;
            叙事分发成品[id] = entry;
            生效中叙事分发集.push(entry);
        }
    }
    // ── 母题词汇库路径 ─────────────────────────────────────────────────────────────────
    // 不进 hashJudgmentBundle·dormant·叙事面词汇
    const 母题词汇成品 = {};
    const 生效中母题词汇集 = [];
    const _母题词汇墓碑库 = {};
    if (motifVocabLib && manifest.母题词汇 && manifest.母题词汇.length > 0) {
        for (const id of manifest.母题词汇) {
            if (!Object.prototype.hasOwnProperty.call(motifVocabLib, id))
                continue;
            const entry = motifVocabLib[id];
            if (!entry)
                continue;
            母题词汇成品[id] = entry;
            生效中母题词汇集.push(entry);
        }
    }
    // ── 母题配额库路径 ─────────────────────────────────────────────────────────────────
    // 进 hashJudgmentBundle·调用方经 投影母题配额库() 回填 母题配额参数·dormant
    const 母题配额成品 = {};
    const 生效中母题配额集 = [];
    const _母题配额墓碑库 = {};
    if (motifQuotaLib && manifest.母题配额 && manifest.母题配额.length > 0) {
        for (const id of manifest.母题配额) {
            if (!Object.prototype.hasOwnProperty.call(motifQuotaLib, id))
                continue;
            const entry = motifQuotaLib[id];
            if (!entry)
                continue;
            母题配额成品[id] = entry;
            生效中母题配额集.push(entry);
        }
    }
    // ── 离场演化契约库路径 ─────────────────────────────────────────────────────────────
    // 不进 hashJudgmentBundle·dormant·P2 offstageSettler consumer
    const 离场演化契约成品 = {};
    const 生效中离场演化契约集 = [];
    const _离场演化契约墓碑库 = {};
    if (offstageContractLib && manifest.离场演化契约 && manifest.离场演化契约.length > 0) {
        for (const id of manifest.离场演化契约) {
            if (!Object.prototype.hasOwnProperty.call(offstageContractLib, id))
                continue;
            const entry = offstageContractLib[id];
            if (!entry)
                continue;
            离场演化契约成品[id] = entry;
            生效中离场演化契约集.push(entry);
        }
    }
    // ── 社会角色库路径 ─────────────────────────────────────────────────────────────────
    // 不进存档·不进 hashJudgmentBundle·dormant·合并旧三表
    const 社会角色成品 = {};
    const 生效中社会角色集 = [];
    const _社会角色墓碑库 = {};
    if (socialRoleLib && manifest.社会角色 && manifest.社会角色.length > 0) {
        for (const id of manifest.社会角色) {
            if (!Object.prototype.hasOwnProperty.call(socialRoleLib, id))
                continue;
            const entry = socialRoleLib[id];
            if (!entry)
                continue;
            社会角色成品[id] = entry;
            生效中社会角色集.push(entry);
        }
    }
    // ── 剥离③ 裸标量聚合（last-write-wins over pack load order · dormant） ────────────
    // 扫 生效中包集（已按 computeLoadOrder 排序）·取最后声明该字段的包的值
    let 聚合历法皮肤 = undefined;
    let 聚合财富分档参数 = undefined;
    let 聚合欠债参数 = undefined;
    let 聚合穿越契约 = undefined;
    let 聚合开局装配数据 = undefined;
    for (const pack of 生效中包集) {
        const p = pack;
        if (p['历法皮肤'] !== undefined)
            聚合历法皮肤 = p['历法皮肤'];
        if (p['财富分档参数'] !== undefined)
            聚合财富分档参数 = p['财富分档参数'];
        if (p['欠债参数'] !== undefined)
            聚合欠债参数 = p['欠债参数'];
        if (p['穿越契约'] !== undefined)
            聚合穿越契约 = p['穿越契约'];
        if (p['开局装配数据'] !== undefined)
            聚合开局装配数据 = p['开局装配数据'];
    }
    return {
        成品, _mod墓碑库: 墓碑库, 生效中包集, 生效中内容包集哈希,
        规则成品, 生效中规则集, _规则墓碑库,
        UI成品, 生效中UI集, _UI墓碑库,
        工具成品, 生效中工具集, _工具墓碑库,
        成就成品, 生效中成就集, _成就墓碑库,
        物品成品, 生效中物品集, _物品墓碑库,
        媒体成品, 生效中媒体集, _媒体墓碑库,
        学业制式成品, 生效中学业制式集, _学业制式墓碑库,
        职级体系成品, 生效中职级体系集, _职级体系墓碑库,
        实体模板成品, 生效中实体模板集, _实体模板墓碑库,
        文风成品, 生效中文风集, _文风墓碑库,
        二审维度成品, 生效中二审维度集, _二审维度墓碑库,
        小剧场剧本成品, 生效中小剧场剧本集, _小剧场剧本墓碑库,
        选项集成品, 生效中选项集集, _选项集墓碑库,
        // 剥离③
        种族模板成品, 生效中种族模板集, _种族模板墓碑库,
        战术包成品, 生效中战术包集, _战术包墓碑库,
        叙事分发成品, 生效中叙事分发集, _叙事分发墓碑库,
        母题词汇成品, 生效中母题词汇集, _母题词汇墓碑库,
        母题配额成品, 生效中母题配额集, _母题配额墓碑库,
        离场演化契约成品, 生效中离场演化契约集, _离场演化契约墓碑库,
        社会角色成品, 生效中社会角色集, _社会角色墓碑库,
        ...(聚合历法皮肤 !== undefined ? { 聚合历法皮肤 } : {}),
        ...(聚合财富分档参数 !== undefined ? { 聚合财富分档参数 } : {}),
        ...(聚合欠债参数 !== undefined ? { 聚合欠债参数 } : {}),
        ...(聚合穿越契约 !== undefined ? { 聚合穿越契约 } : {}),
        ...(聚合开局装配数据 !== undefined ? { 聚合开局装配数据 } : {}),
    };
}
// ── shimThickPreset — 厚预设存档 shim（C2 确定性迁移工具）────────────────────────
// 将含内联规则字段的旧格式预设 object 转为 {薄清单, 规则库条目}
// 调用方再: resolve(shim.manifest, {}, shim.ruleLib) → 规则成品 与旧厚预设规则字段等价
// 确定性：纯函数·不访问时间/随机/DOM·输出仅依赖输入。
export const 规则字段名集 = [
    '难度系数组', '属性轴表', '检定配方表', '派生量配方', '赛事结构模板',
    '规则补丁', '检定骰面', '检定档切分表', '钳制表', '概率域夹逼',
    '死亡拦截器条目', '换角许可', '归并表',
];
/**
 * shimThickPreset(oldPreset) → {manifest, ruleLib}
 *
 * 提取厚预设内联规则字段→单条 rule_id='shim' 规则条目入规则库。
 * resolve(manifest, {}, ruleLib).规则成品 与原厚预设规则字段等价（deepMerge 语义）。
 */
export function shimThickPreset(oldPreset) {
    const 规则面 = {};
    for (const key of 规则字段名集) {
        if (key in oldPreset && oldPreset[key] !== undefined) {
            规则面[key] = oldPreset[key];
        }
    }
    const 薄packs = Array.isArray(oldPreset['packs'])
        ? oldPreset['packs']
        : [];
    const 薄rules = Object.keys(规则面).length > 0 ? ['shim'] : [];
    const manifest = {
        packs: 薄packs,
        ...(薄rules.length > 0 ? { rules: 薄rules } : {}),
    };
    const ruleLib = {};
    if (薄rules.length > 0) {
        ruleLib['shim'] = {
            rule_id: 'shim',
            版本: '0.1.0',
            名称: '',
            作者: '',
            描述: '',
            依赖: [],
            冲突: [],
            规则面: 规则面,
        };
    }
    return { manifest, ruleLib };
}
