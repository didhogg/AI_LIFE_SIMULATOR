// PR-5d · 玩法/Mod 导入·导出接口
// 纯函数·dormant·不接 runTick·不进任何指纹数组（hashJudgmentBundle/hashPresetFingerprint）
// 零文件系统接触（落盘/读盘/IndexedDB 全在宿主层）
// 六禁守恒：禁 Date.now/new Date/Math.random/window/document/localeCompare
// 复用 computeEffectPackHash/聚合生效中内容包集哈希/resolve·禁新写哈希算法
// 路由权威唯一认 pack_id（及各库 by-ID 键）+ content_hash·文件名 core 永不读
import { z } from 'zod';
import { 薄清单Schema, 内容包库Schema } from './preset/contentPack.js';
import { resolve } from './preset/resolve.js';
import { computeEffectPackHash, 聚合生效中内容包集哈希 } from '../interfaces/contentPackHash.js';
// ── 内容包信封 schema（装配层·非 RootSchema 顶层键·schemaKeys 守恒 53） ──────────
// 20 个可选库字段用 z.record(z.string(), z.unknown()).optional() 宽松收录
// 深层结构校验由 resolve() 三层担当·信封层只保证基本形态
const _库字段 = z.record(z.string(), z.unknown()).optional();
export const 内容包信封Schema = z.object({
    格式版本: z.string().default('1.0.0'),
    manifest: 薄清单Schema,
    内容包库: 内容包库Schema, // 条目结构由 内容包条目Schema 严格校验（含 superRefine 模块种子）
    规则库: _库字段,
    UI库: _库字段,
    工具库: _库字段,
    成就库: _库字段,
    物品库: _库字段,
    媒体库: _库字段,
    学业制式库: _库字段,
    职级体系库: _库字段,
    实体模板冰箱: _库字段,
    文风冰箱: _库字段,
    二审维度库: _库字段,
    小剧场剧本库: _库字段,
    选项集库: _库字段,
    种族模板库: _库字段,
    战术包库: _库字段,
    叙事分发库: _库字段,
    母题词汇库: _库字段,
    母题配额库: _库字段,
    离场演化契约库: _库字段,
    社会角色库: _库字段,
    顶层哈希: z.string(),
});
// ─────────────────────────────────────────────────────────────────────────────
// 内部工具函数
// ─────────────────────────────────────────────────────────────────────────────
/** 排除中英文 hash 字段后调 computeEffectPackHash（复用·非新算法） */
function computeEntryHash(entry) {
    const rest = {};
    for (const k of Object.keys(entry)) {
        if (k !== '内容哈希' && k !== 'content_hash')
            rest[k] = entry[k];
    }
    return computeEffectPackHash(rest);
}
/**
 * 对整个库字段做逐条目 hash 校验，返回校验通过的条目集合。
 * 校验失败的条目进 tombs（partial·其余继续）。
 * 使用 hasOwnProperty.call 防原型链污染。
 */
function hashValidateLib(lib, tombs) {
    const out = {};
    if (!lib)
        return out;
    for (const id of Object.keys(lib)) {
        if (!Object.prototype.hasOwnProperty.call(lib, id))
            continue;
        const raw = lib[id];
        if (typeof raw !== 'object' || raw === null)
            continue;
        const entry = raw;
        const computed = computeEntryHash(entry);
        const stored = entry['内容哈希'];
        if (stored !== undefined && stored !== computed) {
            tombs[id] = { 记录键: id, 原因: '其他', 诊断: `${id} 内容哈希不一致（存：${stored}·算：${computed}）` };
            continue;
        }
        out[id] = { ...entry, 内容哈希: computed };
    }
    return out;
}
/**
 * 按 manifest 引用 ID 列表捞条目 + 填写/校验 hash（export 侧使用）。
 * 无 BFS：仅捞直接引用的 ID。
 */
function captureByIds(lib, ids, tombs) {
    const out = {};
    if (!lib || !ids || ids.length === 0)
        return out;
    for (const id of ids) {
        if (!Object.prototype.hasOwnProperty.call(lib, id))
            continue;
        const raw = lib[id];
        if (typeof raw !== 'object' || raw === null)
            continue;
        const entry = raw;
        const computed = computeEntryHash(entry);
        const stored = entry['内容哈希'];
        if (stored !== undefined && stored !== computed) {
            tombs[id] = { 记录键: id, 原因: '其他', 诊断: `${id} 内容哈希不一致（存：${stored}·算：${computed}）` };
            continue;
        }
        out[id] = { ...entry, 内容哈希: computed };
    }
    return out;
}
/**
 * 过滤 incoming 只保留 resolvedIds 内的条目，合并进 existing，
 * same hash → 幂等 no-op；diff hash → 条目进 tombs·禁覆盖（AA3·拍板②）。
 */
function mergeWithCollision(existing, incoming, resolvedIds, tombs) {
    const out = { ...(existing ?? {}) };
    for (const id of Object.keys(incoming)) {
        if (!resolvedIds.has(id))
            continue;
        if (!Object.prototype.hasOwnProperty.call(incoming, id))
            continue;
        const entry = incoming[id];
        if (!Object.prototype.hasOwnProperty.call(out, id)) {
            out[id] = entry;
            continue;
        }
        const existHash = out[id]['内容哈希'];
        const newHash = entry['内容哈希'];
        if (existHash !== newHash) {
            tombs[id] = { 记录键: id, 原因: '覆写授权越权', 诊断: `${id} 已安装（hash 不匹配·禁覆盖）` };
        }
        // same hash → 幂等，不写
    }
    return out;
}
/** 收集信封内所有条目的 内容哈希 值（供顶层 hash 计算） */
function collectAllEntryHashes(信封) {
    const pick = (lib) => lib ? Object.values(lib).map(e => {
        const h = e['内容哈希'];
        return h !== undefined ? { content_hash: h } : {};
    }) : [];
    return [
        ...Object.values(信封.内容包库).map(e => (e.内容哈希 !== undefined ? { content_hash: e.内容哈希 } : {})),
        ...pick(信封.规则库),
        ...pick(信封.UI库),
        ...pick(信封.工具库),
        ...pick(信封.成就库),
        ...pick(信封.物品库),
        ...pick(信封.媒体库),
        ...pick(信封.学业制式库),
        ...pick(信封.职级体系库),
        ...pick(信封.实体模板冰箱),
        ...pick(信封.文风冰箱),
        ...pick(信封.二审维度库),
        ...pick(信封.小剧场剧本库),
        ...pick(信封.选项集库),
        ...pick(信封.种族模板库),
        ...pick(信封.战术包库),
        ...pick(信封.叙事分发库),
        ...pick(信封.母题词汇库),
        ...pick(信封.母题配额库),
        ...pick(信封.离场演化契约库),
        ...pick(信封.社会角色库),
    ];
}
// ─────────────────────────────────────────────────────────────────────────────
/**
 * exportContentPack — 三层校验 → 内容寻址填写 → 装信封 → 返回 raw 对象
 *
 * 步骤：
 * ① resolve() 三层校验·生效中包集空 → 拒（整批）
 * ② 按 manifest 引用 ID 捞各库条目·填写/校验 内容哈希（无 BFS）
 * ③ 顶层哈希 = 聚合生效中内容包集哈希(全条目 content_hash)
 * ④ 装信封 → { ok: true, 信封 }
 */
export function exportContentPack(manifest, library, ruleLib, uiLib, toolLib, achLib, itemLib, mediaLib, academicLib, rankLib, entityTplLib, styleLib, reviewDimLib, stageScriptLib, optionSetLib, raceTemplateLib, tacticPackLib, narrativeDistLib, motifVocabLib, motifQuotaLib, offstageContractLib, socialRoleLib) {
    // ① resolve() 三层校验
    const resolved = resolve(manifest, library, ruleLib, uiLib, toolLib, achLib, itemLib, mediaLib, academicLib, rankLib, entityTplLib, styleLib, reviewDimLib, stageScriptLib, optionSetLib, raceTemplateLib, tacticPackLib, narrativeDistLib, motifVocabLib, motifQuotaLib, offstageContractLib, socialRoleLib);
    if (resolved.生效中包集.length === 0) {
        return { ok: false, 原因: '所有内容包已入墓碑·成品为空', gate: 'export-resolve' };
    }
    // ② 捞各库条目 + hash 填写/校验
    const hashTombs = {};
    // 内容包库：只取 resolve 生效中包集（按 pack_id·hasOwnProperty.call）
    const outPacks = {};
    for (const pack of resolved.生效中包集) {
        const raw = pack;
        const computed = computeEntryHash(raw);
        const stored = pack.内容哈希;
        if (stored !== undefined && stored !== computed) {
            hashTombs[pack.pack_id] = { 记录键: pack.pack_id, pack_id: pack.pack_id, 原因: '其他', 诊断: `${pack.pack_id} 内容哈希不一致` };
            continue;
        }
        outPacks[pack.pack_id] = { ...pack, 内容哈希: computed };
    }
    if (Object.keys(outPacks).length === 0) {
        return { ok: false, 原因: '生效包全部 content_hash 校验失败', gate: 'export-hash' };
    }
    // 各库按 manifest 引用列表捞（无 BFS）
    const outRules = captureByIds(ruleLib, manifest.rules, hashTombs);
    const outUI = captureByIds(uiLib, manifest.ui, hashTombs);
    const outTools = captureByIds(toolLib, manifest.tools, hashTombs);
    const outAch = captureByIds(achLib, manifest.achievements, hashTombs);
    const outItems = captureByIds(itemLib, manifest.items, hashTombs);
    const outMedia = captureByIds(mediaLib, manifest.media, hashTombs);
    const outAca = captureByIds(academicLib, manifest.学业制式, hashTombs);
    const outRank = captureByIds(rankLib, manifest.职级体系, hashTombs);
    const outEnt = captureByIds(entityTplLib, manifest.实体模板, hashTombs);
    const outStyle = captureByIds(styleLib, manifest.文风, hashTombs);
    const outRev = captureByIds(reviewDimLib, manifest.二审维度, hashTombs);
    const outStage = captureByIds(stageScriptLib, manifest.小剧场剧本, hashTombs);
    const outOpt = captureByIds(optionSetLib, manifest.选项集, hashTombs);
    const outRace = captureByIds(raceTemplateLib, manifest.种族模板, hashTombs);
    const outTactic = captureByIds(tacticPackLib, manifest.战术包, hashTombs);
    const outNarr = captureByIds(narrativeDistLib, manifest.叙事分发, hashTombs);
    const outMVoc = captureByIds(motifVocabLib, manifest.母题词汇, hashTombs);
    const outMQuo = captureByIds(motifQuotaLib, manifest.母题配额, hashTombs);
    const outOff = captureByIds(offstageContractLib, manifest.离场演化契约, hashTombs);
    const outSoc = captureByIds(socialRoleLib, manifest.社会角色, hashTombs);
    // ③ 顶层哈希（全条目 内容哈希 值聚合）
    // exactOptionalPropertyTypes：仅在 hash 存在时带 content_hash 字段
    const ch = (h) => h !== undefined ? { content_hash: h } : {};
    const allHashes = [
        ...Object.values(outPacks).map(e => ch(e.内容哈希)),
        ...Object.values(outRules).map(e => ch(e['内容哈希'])),
        ...Object.values(outUI).map(e => ch(e['内容哈希'])),
        ...Object.values(outTools).map(e => ch(e['内容哈希'])),
        ...Object.values(outAch).map(e => ch(e['内容哈希'])),
        ...Object.values(outItems).map(e => ch(e['内容哈希'])),
        ...Object.values(outMedia).map(e => ch(e['内容哈希'])),
        ...Object.values(outAca).map(e => ch(e['内容哈希'])),
        ...Object.values(outRank).map(e => ch(e['内容哈希'])),
        ...Object.values(outEnt).map(e => ch(e['内容哈希'])),
        ...Object.values(outStyle).map(e => ch(e['内容哈希'])),
        ...Object.values(outRev).map(e => ch(e['内容哈希'])),
        ...Object.values(outStage).map(e => ch(e['内容哈希'])),
        ...Object.values(outOpt).map(e => ch(e['内容哈希'])),
        ...Object.values(outRace).map(e => ch(e['内容哈希'])),
        ...Object.values(outTactic).map(e => ch(e['内容哈希'])),
        ...Object.values(outNarr).map(e => ch(e['内容哈希'])),
        ...Object.values(outMVoc).map(e => ch(e['内容哈希'])),
        ...Object.values(outMQuo).map(e => ch(e['内容哈希'])),
        ...Object.values(outOff).map(e => ch(e['内容哈希'])),
        ...Object.values(outSoc).map(e => ch(e['内容哈希'])),
    ];
    const 顶层哈希 = 聚合生效中内容包集哈希(allHashes);
    // ④ 装信封（只装非空库·散布方式兼容 exactOptionalPropertyTypes）
    const 信封 = {
        格式版本: '1.0.0',
        manifest,
        内容包库: outPacks,
        顶层哈希,
        ...(Object.keys(outRules).length > 0 ? { 规则库: outRules } : {}),
        ...(Object.keys(outUI).length > 0 ? { UI库: outUI } : {}),
        ...(Object.keys(outTools).length > 0 ? { 工具库: outTools } : {}),
        ...(Object.keys(outAch).length > 0 ? { 成就库: outAch } : {}),
        ...(Object.keys(outItems).length > 0 ? { 物品库: outItems } : {}),
        ...(Object.keys(outMedia).length > 0 ? { 媒体库: outMedia } : {}),
        ...(Object.keys(outAca).length > 0 ? { 学业制式库: outAca } : {}),
        ...(Object.keys(outRank).length > 0 ? { 职级体系库: outRank } : {}),
        ...(Object.keys(outEnt).length > 0 ? { 实体模板冰箱: outEnt } : {}),
        ...(Object.keys(outStyle).length > 0 ? { 文风冰箱: outStyle } : {}),
        ...(Object.keys(outRev).length > 0 ? { 二审维度库: outRev } : {}),
        ...(Object.keys(outStage).length > 0 ? { 小剧场剧本库: outStage } : {}),
        ...(Object.keys(outOpt).length > 0 ? { 选项集库: outOpt } : {}),
        ...(Object.keys(outRace).length > 0 ? { 种族模板库: outRace } : {}),
        ...(Object.keys(outTactic).length > 0 ? { 战术包库: outTactic } : {}),
        ...(Object.keys(outNarr).length > 0 ? { 叙事分发库: outNarr } : {}),
        ...(Object.keys(outMVoc).length > 0 ? { 母题词汇库: outMVoc } : {}),
        ...(Object.keys(outMQuo).length > 0 ? { 母题配额库: outMQuo } : {}),
        ...(Object.keys(outOff).length > 0 ? { 离场演化契约库: outOff } : {}),
        ...(Object.keys(outSoc).length > 0 ? { 社会角色库: outSoc } : {}),
    };
    return { ok: true, 信封 };
}
// ─────────────────────────────────────────────────────────────────────────────
/**
 * importContentPack — 从信封导入内容包+各库条目至已安装状态
 *
 * 步骤：
 * ① schema parse；格式版本 major ≠ '1' → 整包拒（__envelope__进墓碑）
 * ② 顶层哈希校验（篡改 → 整包拒）
 * ③ 逐条目 hash 校验（partial·不一致 → 条目墓碑·其余继续）
 * ④ resolve() 三层校验（被拒条目进各库墓碑）
 * ⑤ 撞库：same hash → 幂等 no-op / diff hash → 条目进墓碑·禁覆盖
 * ⑥ 合并返回 { 已安装, _mod墓碑库, _各库墓碑 }
 */
export function importContentPack(信封原始, 已安装) {
    const _mod墓碑库 = {};
    const _各库墓碑 = {};
    // ① schema parse
    const parsed = 内容包信封Schema.safeParse(信封原始);
    if (!parsed.success) {
        _mod墓碑库['__envelope__'] = {
            记录键: '__envelope__',
            原因: '其他',
            诊断: `信封 schema 解析失败：${parsed.error.issues[0]?.message ?? '未知'}`,
        };
        return { 已安装, _mod墓碑库, _各库墓碑 };
    }
    const 信封 = parsed.data;
    // 格式版本 major 校验
    const major = 信封.格式版本.split('.')[0];
    if (major !== '1') {
        _mod墓碑库['__envelope__'] = {
            记录键: '__envelope__',
            原因: '其他',
            诊断: `格式版本「${信封.格式版本}」major 不识别（仅支持 major=1）`,
        };
        return { 已安装, _mod墓碑库, _各库墓碑 };
    }
    // ② 顶层哈希校验
    const recompTop = 聚合生效中内容包集哈希(collectAllEntryHashes(信封));
    if (recompTop !== 信封.顶层哈希) {
        _mod墓碑库['__envelope__'] = {
            记录键: '__envelope__',
            原因: '其他',
            诊断: `顶层哈希不匹配（存：${信封.顶层哈希}·算：${recompTop}）·整包拒`,
        };
        return { 已安装, _mod墓碑库, _各库墓碑 };
    }
    // ③ 逐条目 hash 校验（各库全量·partial 接受）
    const packHashTombs = {};
    const ruleHashTombs = {};
    const libHashTombs = {};
    // 内容包库：信封里用 内容包条目Schema 已校验结构·只需 hash 检
    const validPacks = {};
    for (const pid of Object.keys(信封.内容包库)) {
        if (!Object.prototype.hasOwnProperty.call(信封.内容包库, pid))
            continue;
        const pack = 信封.内容包库[pid];
        if (!pack)
            continue;
        const computed = computeEntryHash(pack);
        const stored = pack.内容哈希;
        if (stored !== undefined && stored !== computed) {
            packHashTombs[pid] = { 记录键: pid, pack_id: pack.pack_id, 原因: '其他', 诊断: `${pid} 内容哈希不一致` };
            continue;
        }
        validPacks[pid] = { ...pack, 内容哈希: computed };
    }
    // 各库字段（全量·无 BFS）
    const validRules = hashValidateLib(信封.规则库, ruleHashTombs);
    const validUI = hashValidateLib(信封.UI库, libHashTombs);
    const validTools = hashValidateLib(信封.工具库, libHashTombs);
    const validAch = hashValidateLib(信封.成就库, libHashTombs);
    const validItems = hashValidateLib(信封.物品库, libHashTombs);
    const validMedia = hashValidateLib(信封.媒体库, libHashTombs);
    const validAca = hashValidateLib(信封.学业制式库, libHashTombs);
    const validRank = hashValidateLib(信封.职级体系库, libHashTombs);
    const validEnt = hashValidateLib(信封.实体模板冰箱, libHashTombs);
    const validStyle = hashValidateLib(信封.文风冰箱, libHashTombs);
    const validRev = hashValidateLib(信封.二审维度库, libHashTombs);
    const validStage = hashValidateLib(信封.小剧场剧本库, libHashTombs);
    const validOpt = hashValidateLib(信封.选项集库, libHashTombs);
    const validRace = hashValidateLib(信封.种族模板库, libHashTombs);
    const validTactic = hashValidateLib(信封.战术包库, libHashTombs);
    const validNarr = hashValidateLib(信封.叙事分发库, libHashTombs);
    const validMVoc = hashValidateLib(信封.母题词汇库, libHashTombs);
    const validMQuo = hashValidateLib(信封.母题配额库, libHashTombs);
    const validOff = hashValidateLib(信封.离场演化契约库, libHashTombs);
    const validSoc = hashValidateLib(信封.社会角色库, libHashTombs);
    // 收录 hash 墓碑
    for (const [k, v] of Object.entries(packHashTombs))
        _mod墓碑库[k] = v;
    if (Object.keys(ruleHashTombs).length > 0)
        _各库墓碑['规则库_hash'] = ruleHashTombs;
    if (Object.keys(libHashTombs).length > 0)
        _各库墓碑['各库_hash'] = libHashTombs;
    const n = (r) => Object.keys(r).length > 0 ? r : undefined;
    // ④ resolve() 三层校验
    const resolved = resolve(信封.manifest, validPacks, n(validRules), n(validUI), n(validTools), n(validAch), n(validItems), n(validMedia), n(validAca), n(validRank), n(validEnt), n(validStyle), n(validRev), n(validStage), n(validOpt), n(validRace), n(validTactic), n(validNarr), n(validMVoc), n(validMQuo), n(validOff), n(validSoc));
    // 收录 resolve() 各库墓碑
    const r2io = (t) => t;
    for (const [k, v] of Object.entries(resolved._mod墓碑库))
        _mod墓碑库[k] = v;
    if (Object.keys(resolved._规则墓碑库).length > 0)
        _各库墓碑['规则库'] = r2io(resolved._规则墓碑库);
    if (Object.keys(resolved._UI墓碑库).length > 0)
        _各库墓碑['UI库'] = r2io(resolved._UI墓碑库);
    if (Object.keys(resolved._工具墓碑库).length > 0)
        _各库墓碑['工具库'] = r2io(resolved._工具墓碑库);
    if (Object.keys(resolved._成就墓碑库).length > 0)
        _各库墓碑['成就库'] = r2io(resolved._成就墓碑库);
    if (Object.keys(resolved._物品墓碑库).length > 0)
        _各库墓碑['物品库'] = r2io(resolved._物品墓碑库);
    if (Object.keys(resolved._媒体墓碑库).length > 0)
        _各库墓碑['媒体库'] = r2io(resolved._媒体墓碑库);
    if (Object.keys(resolved._学业制式墓碑库).length > 0)
        _各库墓碑['学业制式库'] = r2io(resolved._学业制式墓碑库);
    if (Object.keys(resolved._职级体系墓碑库).length > 0)
        _各库墓碑['职级体系库'] = r2io(resolved._职级体系墓碑库);
    if (Object.keys(resolved._实体模板墓碑库).length > 0)
        _各库墓碑['实体模板冰箱'] = r2io(resolved._实体模板墓碑库);
    if (Object.keys(resolved._文风墓碑库).length > 0)
        _各库墓碑['文风冰箱'] = r2io(resolved._文风墓碑库);
    if (Object.keys(resolved._二审维度墓碑库).length > 0)
        _各库墓碑['二审维度库'] = r2io(resolved._二审维度墓碑库);
    if (Object.keys(resolved._小剧场剧本墓碑库).length > 0)
        _各库墓碑['小剧场剧本库'] = r2io(resolved._小剧场剧本墓碑库);
    if (Object.keys(resolved._选项集墓碑库).length > 0)
        _各库墓碑['选项集库'] = r2io(resolved._选项集墓碑库);
    if (Object.keys(resolved._种族模板墓碑库).length > 0)
        _各库墓碑['种族模板库'] = r2io(resolved._种族模板墓碑库);
    if (Object.keys(resolved._战术包墓碑库).length > 0)
        _各库墓碑['战术包库'] = r2io(resolved._战术包墓碑库);
    if (Object.keys(resolved._叙事分发墓碑库).length > 0)
        _各库墓碑['叙事分发库'] = r2io(resolved._叙事分发墓碑库);
    if (Object.keys(resolved._母题词汇墓碑库).length > 0)
        _各库墓碑['母题词汇库'] = r2io(resolved._母题词汇墓碑库);
    if (Object.keys(resolved._母题配额墓碑库).length > 0)
        _各库墓碑['母题配额库'] = r2io(resolved._母题配额墓碑库);
    if (Object.keys(resolved._离场演化契约墓碑库).length > 0)
        _各库墓碑['离场演化契约库'] = r2io(resolved._离场演化契约墓碑库);
    if (Object.keys(resolved._社会角色墓碑库).length > 0)
        _各库墓碑['社会角色库'] = r2io(resolved._社会角色墓碑库);
    // ⑤ 撞库检测 + 合并（只装 resolve 生效条目）
    const packIds = new Set(resolved.生效中包集.map(p => p.pack_id));
    const ruleIds = new Set(resolved.生效中规则集.map(r => r.rule_id));
    const uiIds = new Set(Object.keys(resolved.UI成品));
    const toolIds = new Set(Object.keys(resolved.工具成品));
    const achIds = new Set(Object.keys(resolved.成就成品));
    const itemIds = new Set(Object.keys(resolved.物品成品));
    const mediaIds = new Set(Object.keys(resolved.媒体成品));
    const acaIds = new Set(Object.keys(resolved.学业制式成品));
    const rankIds = new Set(Object.keys(resolved.职级体系成品));
    const entIds = new Set(Object.keys(resolved.实体模板成品));
    const styleIds = new Set(Object.keys(resolved.文风成品));
    const revIds = new Set(Object.keys(resolved.二审维度成品));
    const stageIds = new Set(Object.keys(resolved.小剧场剧本成品));
    const optIds = new Set(Object.keys(resolved.选项集成品));
    const raceIds = new Set(Object.keys(resolved.种族模板成品));
    const tacticIds = new Set(Object.keys(resolved.战术包成品));
    const narrIds = new Set(Object.keys(resolved.叙事分发成品));
    const mVocIds = new Set(Object.keys(resolved.母题词汇成品));
    const mQuoIds = new Set(Object.keys(resolved.母题配额成品));
    const offIds = new Set(Object.keys(resolved.离场演化契约成品));
    const socIds = new Set(Object.keys(resolved.社会角色成品));
    const packCollTombs = {};
    const ruleCollTombs = {};
    const libCollTombs = {};
    const mergedPacks = mergeWithCollision(已安装.内容包库, validPacks, packIds, packCollTombs);
    const mergedRules = mergeWithCollision(已安装.规则库, validRules, ruleIds, ruleCollTombs);
    const mergedUI = mergeWithCollision(已安装.UI库, validUI, uiIds, libCollTombs);
    const mergedTools = mergeWithCollision(已安装.工具库, validTools, toolIds, libCollTombs);
    const mergedAch = mergeWithCollision(已安装.成就库, validAch, achIds, libCollTombs);
    const mergedItems = mergeWithCollision(已安装.物品库, validItems, itemIds, libCollTombs);
    const mergedMedia = mergeWithCollision(已安装.媒体库, validMedia, mediaIds, libCollTombs);
    const mergedAca = mergeWithCollision(已安装.学业制式库, validAca, acaIds, libCollTombs);
    const mergedRank = mergeWithCollision(已安装.职级体系库, validRank, rankIds, libCollTombs);
    const mergedEnt = mergeWithCollision(已安装.实体模板冰箱, validEnt, entIds, libCollTombs);
    const mergedStyle = mergeWithCollision(已安装.文风冰箱, validStyle, styleIds, libCollTombs);
    const mergedRev = mergeWithCollision(已安装.二审维度库, validRev, revIds, libCollTombs);
    const mergedStage = mergeWithCollision(已安装.小剧场剧本库, validStage, stageIds, libCollTombs);
    const mergedOpt = mergeWithCollision(已安装.选项集库, validOpt, optIds, libCollTombs);
    const mergedRace = mergeWithCollision(已安装.种族模板库, validRace, raceIds, libCollTombs);
    const mergedTactic = mergeWithCollision(已安装.战术包库, validTactic, tacticIds, libCollTombs);
    const mergedNarr = mergeWithCollision(已安装.叙事分发库, validNarr, narrIds, libCollTombs);
    const mergedMVoc = mergeWithCollision(已安装.母题词汇库, validMVoc, mVocIds, libCollTombs);
    const mergedMQuo = mergeWithCollision(已安装.母题配额库, validMQuo, mQuoIds, libCollTombs);
    const mergedOff = mergeWithCollision(已安装.离场演化契约库, validOff, offIds, libCollTombs);
    const mergedSoc = mergeWithCollision(已安装.社会角色库, validSoc, socIds, libCollTombs);
    for (const [k, v] of Object.entries(packCollTombs))
        _mod墓碑库[k] = v;
    if (Object.keys(ruleCollTombs).length > 0)
        _各库墓碑['规则库_碰撞'] = ruleCollTombs;
    if (Object.keys(libCollTombs).length > 0)
        _各库墓碑['各库_碰撞'] = libCollTombs;
    // ⑥ 组装 已安装（只装有内容的库）
    const 新已安装 = {
        内容包库: mergedPacks,
        ...(Object.keys(mergedRules).length > 0 ? { 规则库: mergedRules } : {}),
        ...(Object.keys(mergedUI).length > 0 ? { UI库: mergedUI } : {}),
        ...(Object.keys(mergedTools).length > 0 ? { 工具库: mergedTools } : {}),
        ...(Object.keys(mergedAch).length > 0 ? { 成就库: mergedAch } : {}),
        ...(Object.keys(mergedItems).length > 0 ? { 物品库: mergedItems } : {}),
        ...(Object.keys(mergedMedia).length > 0 ? { 媒体库: mergedMedia } : {}),
        ...(Object.keys(mergedAca).length > 0 ? { 学业制式库: mergedAca } : {}),
        ...(Object.keys(mergedRank).length > 0 ? { 职级体系库: mergedRank } : {}),
        ...(Object.keys(mergedEnt).length > 0 ? { 实体模板冰箱: mergedEnt } : {}),
        ...(Object.keys(mergedStyle).length > 0 ? { 文风冰箱: mergedStyle } : {}),
        ...(Object.keys(mergedRev).length > 0 ? { 二审维度库: mergedRev } : {}),
        ...(Object.keys(mergedStage).length > 0 ? { 小剧场剧本库: mergedStage } : {}),
        ...(Object.keys(mergedOpt).length > 0 ? { 选项集库: mergedOpt } : {}),
        ...(Object.keys(mergedRace).length > 0 ? { 种族模板库: mergedRace } : {}),
        ...(Object.keys(mergedTactic).length > 0 ? { 战术包库: mergedTactic } : {}),
        ...(Object.keys(mergedNarr).length > 0 ? { 叙事分发库: mergedNarr } : {}),
        ...(Object.keys(mergedMVoc).length > 0 ? { 母题词汇库: mergedMVoc } : {}),
        ...(Object.keys(mergedMQuo).length > 0 ? { 母题配额库: mergedMQuo } : {}),
        ...(Object.keys(mergedOff).length > 0 ? { 离场演化契约库: mergedOff } : {}),
        ...(Object.keys(mergedSoc).length > 0 ? { 社会角色库: mergedSoc } : {}),
    };
    return { 已安装: 新已安装, _mod墓碑库, _各库墓碑 };
}
