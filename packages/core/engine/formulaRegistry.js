// F1/F2 · 公式/参数 override substrate
//
// F1: 39 具名公式点注册表（默认值 = 当前硬编码·零重定基守卫）
// F2: resolveEffectiveFormula — 双轨 override 解析器
//     优先级：① enabled=false → 默认（全局锁闭）
//             ② 玩家 DSL 串（$AI创作状态.公式override表） → evalExpr；非法串 fail-safe 回默认
//             ③ 作者预设数字（preset formulaPresetConfig） → typed 数字
//             ④ 默认（现硬编码值）
//
// 指纹铁律：默认值 = 现硬编码 → 默认配置 0 重定基 / 金向量逐位恒等
// 六禁：禁 Date.now/new Date/Math.random/localeCompare/裸JSON.stringify/NFC
// 红线：不改 evalExpr/tryParseExpr 函数体·仅调用
import { fixedExp } from './math/fixed.js';
import { evalExpr } from './dsl/eval.js';
import { tryParseExpr } from './dsl/parser.js';
// ── F1: 公式点 key 列表（39 点·一次性建底座） ─────────────────────────────────────
export const FORMULA_POINT_KEYS = [
    // tick.ts — R1 社会动力学 13 + 记忆衰减 + 缺失回退魔数
    'ripple_decay',
    'ripple_min',
    'rel_ripple_threshold',
    'chronicle_public_threshold',
    'indirect_appraisal_factor',
    'unknown_dim_coeff',
    'region_hop_decay',
    'spatial_factor_min',
    'spatial_factor_max',
    'ic_rate_default',
    'resource_suppression_max',
    'fake_edict_credibility_factor',
    'seir_conflict_absorption_threshold',
    'seir_conflict_absorption_factor',
    'memory_recency_rate',
    'default_physique',
    'default_loyalty',
    'default_span_minutes',
    // check.ts — 检定主公式系数 + 属性综合除数
    'check_proficiency_coeff',
    'check_level_coeff',
    'attr_combine_divisor',
    // cognitionProjection.ts — 认知投影层参数
    'colocation_boost',
    'prestige_scale',
    'access_min',
    'investigation_boost_min',
    'investigation_boost_max',
    // beliefDerive.ts — 信念推理阈值（叙事层·不进指纹）
    'belief_trust_threshold',
    // lodEngine.ts — LOD 粗节点属性实体化范围
    'lod_attr_range_lo',
    'lod_attr_range_hi',
    // economyEngine.ts — 价格钳制 + 漂移阈值
    'economy_price_clamp_lo',
    'economy_price_clamp_hi',
    'economy_drift_threshold',
    // crossDomain.ts — 跨域利息年度分钟（日历锚定·结账公式分母）
    'cross_domain_year_minutes',
    // relationGraph.ts — 装配期关系图常量
    'rel_coloc_base',
    'rel_org_bonus',
    'rel_jitter_max',
    'rel_trust',
    'rel_max_degree',
    'rel_depth_default',
];
// indirect_appraisal_factor 默认值 = fixedExp(-ln2) ≈ 0.5（确定性·禁 Math.exp）
const _INDIRECT_FACTOR_DEFAULT = fixedExp(-0.6931471805599453);
export const FORMULA_REGISTRY = {
    // ── tick.ts R1 社会动力学 13 ─────────────────────────────────────────────────
    ripple_decay: { key: 'ripple_decay', defaultValue: 0.5, description: '二跳涟漪强度乘子', fingerprint: true },
    ripple_min: { key: 'ripple_min', defaultValue: 1, description: '涟漪最低强度写入阈值', fingerprint: true },
    rel_ripple_threshold: { key: 'rel_ripple_threshold', defaultValue: 50, description: 'Phase6 关系触发涟漪强度阈值', fingerprint: true },
    chronicle_public_threshold: { key: 'chronicle_public_threshold', defaultValue: 50, description: '编年史公共知识量级阈值', fingerprint: true },
    indirect_appraisal_factor: { key: 'indirect_appraisal_factor', defaultValue: _INDIRECT_FACTOR_DEFAULT, description: '二手转述情绪淡化系数（≈0.5）', fingerprint: true },
    unknown_dim_coeff: { key: 'unknown_dim_coeff', defaultValue: 0.3, description: '未知维度默认情绪强度系数', fingerprint: true },
    region_hop_decay: { key: 'region_hop_decay', defaultValue: 0.7, description: '区域跳衰减乘子', fingerprint: true },
    spatial_factor_min: { key: 'spatial_factor_min', defaultValue: 0.1, description: '空间传播因子下界', fingerprint: true },
    spatial_factor_max: { key: 'spatial_factor_max', defaultValue: 1.5, description: '空间传播因子上界', fingerprint: true },
    ic_rate_default: { key: 'ic_rate_default', defaultValue: 0.8, description: 'IC 边类型速率未知类型回退值', fingerprint: true },
    resource_suppression_max: { key: 'resource_suppression_max', defaultValue: 0.5, description: '资源紧张度最大传播抑制系数', fingerprint: true },
    fake_edict_credibility_factor: { key: 'fake_edict_credibility_factor', defaultValue: 0.5, description: '矫诏官方信道可信度折半系数', fingerprint: true },
    seir_conflict_absorption_threshold: { key: 'seir_conflict_absorption_threshold', defaultValue: 30, description: 'SEIR R 态冲突吸收印象强度阈值', fingerprint: true },
    seir_conflict_absorption_factor: { key: 'seir_conflict_absorption_factor', defaultValue: 0.5, description: 'SEIR 冲突吸收衰减系数', fingerprint: true },
    // ── tick.ts 记忆衰减 + 缺失回退 ───────────────────────────────────────────────
    memory_recency_rate: { key: 'memory_recency_rate', defaultValue: 0.995, description: '记忆召回权重每拍衰减率', fingerprint: true },
    default_physique: { key: 'default_physique', defaultValue: 10, description: 'Granovetter 阈值计算缺省体质值', fingerprint: true },
    default_loyalty: { key: 'default_loyalty', defaultValue: 50, description: '组织信道成员忠诚度缺省值', fingerprint: true },
    default_span_minutes: { key: 'default_span_minutes', defaultValue: 43200, description: '缺省拍跨度（分钟）', fingerprint: true },
    // ── check.ts ─────────────────────────────────────────────────────────────────
    check_proficiency_coeff: { key: 'check_proficiency_coeff', defaultValue: 0.4, description: '检定公式熟练系数', fingerprint: true },
    check_level_coeff: { key: 'check_level_coeff', defaultValue: 3, description: '检定公式等级系数', fingerprint: true },
    attr_combine_divisor: { key: 'attr_combine_divisor', defaultValue: 2, description: '属性综合除数（主+Σ副）/N', fingerprint: true },
    // ── cognitionProjection.ts ────────────────────────────────────────────────────
    colocation_boost: { key: 'colocation_boost', defaultValue: 30, description: '同场导通加成（认知投影）', fingerprint: true },
    prestige_scale: { key: 'prestige_scale', defaultValue: 200, description: '声望乘子分母', fingerprint: true },
    access_min: { key: 'access_min', defaultValue: 1, description: '投影最低印象强度阈值', fingerprint: true },
    investigation_boost_min: { key: 'investigation_boost_min', defaultValue: 1, description: 'investigation 了解度提升下限', fingerprint: true },
    investigation_boost_max: { key: 'investigation_boost_max', defaultValue: 30, description: 'investigation 了解度提升上限', fingerprint: true },
    // ── beliefDerive.ts ───────────────────────────────────────────────────────────
    belief_trust_threshold: { key: 'belief_trust_threshold', defaultValue: 60, description: '信念推理信任强度阈值（叙事层）', fingerprint: false },
    // ── lodEngine.ts ──────────────────────────────────────────────────────────────
    lod_attr_range_lo: { key: 'lod_attr_range_lo', defaultValue: 20, description: 'LOD 粗节点属性实体化下界', fingerprint: true },
    lod_attr_range_hi: { key: 'lod_attr_range_hi', defaultValue: 60, description: 'LOD 粗节点属性实体化上界', fingerprint: true },
    // ── economyEngine.ts ──────────────────────────────────────────────────────────
    economy_price_clamp_lo: { key: 'economy_price_clamp_lo', defaultValue: 0.5, description: '有效价格修正系数钳制下界', fingerprint: true },
    economy_price_clamp_hi: { key: 'economy_price_clamp_hi', defaultValue: 3.0, description: '有效价格修正系数钳制上界', fingerprint: true },
    economy_drift_threshold: { key: 'economy_drift_threshold', defaultValue: 0.2, description: '价格漂移候选再基线触发阈值', fingerprint: true },
    // ── crossDomain.ts ────────────────────────────────────────────────────────────
    cross_domain_year_minutes: { key: 'cross_domain_year_minutes', defaultValue: 518400, description: '跨域利息年度分钟（12×30×1440）', fingerprint: true },
    // ── relationGraph.ts ──────────────────────────────────────────────────────────
    rel_coloc_base: { key: 'rel_coloc_base', defaultValue: 30, description: '装配期共址基底强度', fingerprint: true },
    rel_org_bonus: { key: 'rel_org_bonus', defaultValue: 30, description: '装配期同组织叠加增量', fingerprint: true },
    rel_jitter_max: { key: 'rel_jitter_max', defaultValue: 10, description: '装配期 seeded 抖动上限', fingerprint: true },
    rel_trust: { key: 'rel_trust', defaultValue: 100, description: '装配期生成边信任度', fingerprint: true },
    rel_max_degree: { key: 'rel_max_degree', defaultValue: 10, description: '每 NPC 最大关系边数', fingerprint: true },
    rel_depth_default: { key: 'rel_depth_default', defaultValue: 20, description: '装配期生成边默认深度', fingerprint: true },
};
/**
 * 双轨 override 解析器（F2 核心函数）。
 *
 * 优先级（高→低）：
 *   ① enabled=false → 返回 defaultValue（全局锁闭）
 *   ② 玩家 DSL 串 → tryParseExpr + evalExpr；非法串 fail-safe 回 defaultValue
 *   ③ 作者预设数字 → typed 数字 override
 *   ④ defaultValue（现硬编码值·零重定基守卫）
 *
 * 确定性铁律：不引入任何非确定性源；fail-safe 路径严格回 defaultValue。
 */
export function resolveEffectiveFormula(key, defaultValue, presetConfigNumber, dslString, enabled, ctx = {}) {
    if (!enabled)
        return defaultValue;
    // ② 玩家 DSL 轨（最高 override 优先级·运行态·fail-safe）
    if (dslString) {
        const expr = tryParseExpr(dslString);
        if (expr !== null) {
            const val = evalExpr(expr, ctx);
            if (Number.isFinite(val))
                return val;
        }
        // 非法串 → fail-safe 继续往下（不抛·不崩）
    }
    // ③ 作者预设数字轨（typed 数字·静态）
    if (presetConfigNumber !== undefined && Number.isFinite(presetConfigNumber)) {
        return presetConfigNumber;
    }
    // ④ 默认
    return defaultValue;
}
/**
 * 便捷包装：从 FormulaResolveConfig 解析指定公式点有效值。
 * 当 config 为 undefined 时严格等价于返回注册表默认值（零重定基）。
 */
export function resolveFormula(key, config) {
    const desc = FORMULA_REGISTRY[key];
    if (!config)
        return desc.defaultValue;
    return resolveEffectiveFormula(key, desc.defaultValue, config.presetNumbers?.[key], config.playerDsl?.[key], config.enabled ?? true, config.ctx ?? {});
}
