// hosts/slice/fixture/world.ts
// ──────────────────────────────────────────────────────────────────────────────
// 样例世界（纵切 MVP fixture）：1 主角 + 2 NPC + 1 地点 + 1 秘密。
//
// 唯一职责 = 定义并导出「世界常量 + buildWorld()」，供 server.ts / index.ts /
// assemble.ts 消费。本文件【只描述样例数据】，绝不含 server / HTTP / 结算 / 闸逻辑。
//
// 铁律对齐：实体键是稳定结构键（禁随显示名漂移）；能派生的不在此存储；
// SAVE_SEED / RECIPE 这些判定输入是确定性重放的取材，改动需 bump 指纹。
// ──────────────────────────────────────────────────────────────────────────────
import { RootSchema, SINK_ENTITY_KEY } from '@ai-life-sim/core';
// ── 实体键（稳定结构键）─────────────────────────────────────────────────────────
export const PC = "pc_linjiu";
export const NPC_WANG = "npc_wang";
export const NPC_HONG = "npc_hong";
// 地点：实体键(LOC_KEY) 与 显示名(LOC_NAME) 分离。
// server.ts 用 LOC_NAME 作 assemblePrompt 的 locName；NPC.位置 用 LOC_KEY 做在场判定。
export const LOC_KEY = "loc_yuelai_inn";
export const LOC_NAME = "悦来客栈";
// ── 存档种子（沿用 M2 黄金向量 seed=42，保持既有 m2.test.ts 恒等）────────────────
export const SAVE_SEED = 42;
// ── 判定配方（进判定面指纹）：说服赊账  1d20 + 魅力(6) ≥ DC(12) 即成功 ────────────
export const RECIPE_KEY = "chk_persuade_credit";
export const RECIPE = {
    key: RECIPE_KEY,
    技能: "说服赊账",
    骰型: "1d20",
    dc: 12, // server.ts 读 RECIPE.dc
    attrBonus: 6, // server.ts 读 RECIPE.attrBonus（魅力轴 = 6）
    难度口径: "中等",
};
// ── 赊账参数：王掌柜垫 8 文等值酒菜给林九 ──────────────────────────────────────────
export const CREDIT_AMOUNT = 8;
export const CREDIT_REASON = "赊账·酒菜";
// ── 初始账本余额（P0-7 守恒接线·与 INITIAL_BALANCES in server.ts 同口径）────────────
export const INITIAL_PC_BALANCE = 30;
export const INITIAL_WANG_BALANCE = 200;
export const INITIAL_HONG_BALANCE = 0;
export const EXPECTED_NET_ASSET = INITIAL_PC_BALANCE + INITIAL_WANG_BALANCE + INITIAL_HONG_BALANCE;
// ── 货币单位（显示用后缀）：规范单位「文」，与 CANONICAL_UNITS / index.ts 账面打印一致 ────────────
export const CURRENCY = "文";
// ── 秘密库（知情过滤 filterSecretsForPOV 的输入）────────────────────────────────
export const SECRET_S1 = "S1";
const 秘密库 = {
    // S1：王掌柜在后院私藏一名被官府通缉的旧友；初始仅 npc_wang 知情。
    S1: {
        母题: "窝藏通缉旧友",
        涉事方: [],
        进展: 0,
        严重度: 70,
        暴露度: 0,
        $谜底: "王掌柜在悦来客栈后院私藏了一名被官府通缉的旧友。",
        已暴露线索: [],
        知情名单: [
            {
                对象: NPC_WANG,
                知情程度: 100,
                立场: "死守",
                掩护基调: "佯装不知，岗开话题",
            },
        ],
    },
};
// ── 世界构造（每次返回全新对象·RootSchema.parse 填满所有默认字段·消除 TS 类型债）──
// 机敏/身份(string)/与主角关系 不在 core NPC schema 中·Zod strip 后运行时无影响。
export function buildWorld() {
    return RootSchema.parse({
        全局: {
            地点: {
                [LOC_KEY]: { 名称: LOC_NAME, 描述: "清河镇运河边第一家落脚处，往来客商多、消息杂。" },
            },
            秘密库,
        },
        NPC: {
            // 主角也登记在 NPC 表里（server.ts 用 state.NPC[PC].位置 做在场判定）
            [PC]:       { 姓名: "林九",  位置: LOC_KEY, 属性: { 体质: 5, 魅力: 6 } },
            [NPC_WANG]: { 姓名: "王掌柜", 位置: LOC_KEY },
            [NPC_HONG]: { 姓名: "红姨",  位置: LOC_KEY },
        },
        货币系统: {
            基准币种: CURRENCY,
            账户: {
                [PC]:              { 持有: { [CURRENCY]: INITIAL_PC_BALANCE } },
                [NPC_WANG]:        { 持有: { [CURRENCY]: INITIAL_WANG_BALANCE } },
                [NPC_HONG]:        { 持有: { [CURRENCY]: INITIAL_HONG_BALANCE } },
                [SINK_ENTITY_KEY]: { 持有: { [CURRENCY]: 0 } },
            },
        },
    });
}
