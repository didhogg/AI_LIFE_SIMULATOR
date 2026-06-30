// PR-瘦身-底座-2b · 规则库 schema + 双轨搬入（12 张规则表种子视图）
// additive-only: 厚预设字段一律不动·双轨并存
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 纯 schema + 派生常量·无副作用·禁 Date.now/Math.random/window/document
// schemaKeys 守恒 52：规则库属装配层·不进 RootSchema
import { z } from 'zod';
import { 难度系数组Schema, 属性轴表Schema, 检定配方表Schema, 派生量配方Schema, 赛事结构模板Schema, 规则补丁Schema, 检定骰面Schema, 检定档切分表Schema, 钳制表Schema, 概率域夹逼Schema, 死亡拦截器条目Schema, 换角许可Schema, 粒度模板覆盖Schema, } from '../../schema/preset.js';
import { 种子视图 } from './seedView.js';
const rule_id正则 = /^[a-z][a-z0-9_]*$/;
// ── 规则元数据 — mirror 内容包元数据口径（rule_id 正则同 pack_id） ─────────────
export const 规则元数据Schema = z.object({
    rule_id: z.string().regex(rule_id正则, { message: 'rule_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
    版本: z.string().default('0.1.0'),
    名称: z.string().default(''),
    作者: z.string().default(''),
    描述: z.string().default(''),
    依赖: z.array(z.string()).default([]),
    冲突: z.array(z.string()).default([]),
    内容哈希: z.string().optional(),
    // A2 口径对齐（additive·可空·resolve() 消费·不进 hashJudgmentBundle）
    基底契约: z.string().optional().refine(v => {
        if (v === undefined || v === '')
            return true;
        if (/[\^~]/.test(v) || v.includes('||') || v.includes('-'))
            return false;
        return v.trim().split(/\s+/).every(part => /^(>=|<=|>|<|=)?\d+\.\d+\.\d+$/.test(part));
    }, { message: '基底契约须为 semver range（>=1.0.0 <2.0.0）·不支持 ^/~/||/prerelease' }),
    可写键: z.array(z.string()).optional(),
    轨道: z.enum(['gameplay', 'cosmetic', 'view', 'macro']).optional(),
});
// ── 规则面 — 12 张规则表 + 归并表 各自 种子视图 的 optional 组合 ──────────────
// 一条目可携任意子集；作者加规则 = 加一条目；零枚举
// 各字段经 种子视图() 剥除 ZodDefault / ZodEffects·全字段 optional·无 0 default 污染
export const 规则面Schema = z.object({
    // 玩法预设 :480 难度系数组
    难度系数组: 种子视图(难度系数组Schema).optional(),
    // 玩法预设 :482 属性轴表
    属性轴表: 种子视图(属性轴表Schema).optional(),
    // 玩法预设 :483 检定配方表
    检定配方表: 种子视图(检定配方表Schema).optional(),
    // 玩法预设 :484 派生量配方
    派生量配方: 种子视图(派生量配方Schema).optional(),
    // 玩法预设 :496 赛事结构模板
    赛事结构模板: 种子视图(赛事结构模板Schema).optional(),
    // 玩法预设 :498 规则补丁
    规则补丁: 种子视图(规则补丁Schema).optional(),
    // 玩法预设 :500 检定骰面
    检定骰面: 种子视图(检定骰面Schema).optional(),
    // 玩法预设 :508 检定档切分表
    检定档切分表: 种子视图(检定档切分表Schema).optional(),
    // 玩法预设 :509 钳制表
    钳制表: 种子视图(钳制表Schema).optional(),
    // 玩法预设 :510 概率域夹逼
    概率域夹逼: 种子视图(概率域夹逼Schema).optional(),
    // 玩法预设 :535 死亡拦截器条目（list）
    死亡拦截器条目: 种子视图(z.array(死亡拦截器条目Schema)).optional(),
    // 玩法预设 :537 换角许可
    换角许可: 种子视图(换角许可Schema).optional(),
    // 玩法预设 :522 归并表（一并纳入）
    归并表: z.record(z.string(), z.unknown()).optional(),
    // ── ③1A 判定面补完（粒度/纠缠闭包/约定谓词/级联限制·Step1A 迁入·dormant）──────
    粒度模板覆盖: 种子视图(粒度模板覆盖Schema).optional(),
    纠缠闭包弱边阈值: z.number().min(0).max(1).optional(),
    约定谓词集: z.record(z.string(), z.string()).optional(),
    级联限制: z.object({
        最大深度: z.number().int().min(0),
        最大轮数: z.number().int().min(0),
    }).optional(),
});
// ── 规则条目 = 规则元数据 + 规则面 ──────────────────────────────────────────────
// 规则面 schema 自带结构校验（种子视图 passthrough）·与 内容包条目Schema 同族模式
export const 规则条目Schema = z.object({
    ...规则元数据Schema.shape,
    规则面: 规则面Schema.optional(),
});
// ── 规则库 = record<rule_id, 规则条目>.default({}) ──────────────────────────────
export const 规则库Schema = z.record(z.string().regex(rule_id正则), 规则条目Schema).default({});
// 规则面键集（17 项：12 张规则表 + 归并表 + ③1A 四字段·供外部引用·派生自 规则面Schema.shape）
export const 规则面键集 = Object.keys(规则面Schema.shape);
