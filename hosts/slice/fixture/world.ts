// hosts/slice/fixture/world.ts
// ──────────────────────────────────────────────────────────────────────────────
// 样例世界（纵切 MVP fixture）：1 主角 + 2 NPC + 1 地点 + 1 秘密。
//
// 唯一职责 = 定义并导出「世界常量 + buildWorld()」，供 server.ts / index.ts /
// assemble.ts 消费。本文件【只描述样例数据】，绝不含 server / HTTP / 结算 / 闸逻辑。
// （上一份被一份 server.ts 副本覆盖，导致 import 路径多套一层 fixture/ 而报
//   ERR_MODULE_NOT_FOUND，这里重建为它本来的身份。）
//
// 铁律对齐：实体键是稳定结构键（禁随显示名漂移）；能派生的不在此存储；
// SAVE_SEED / RECIPE 这些判定输入是确定性重放的取材，改动需 bump 指纹。
// ──────────────────────────────────────────────────────────────────────────────

import type { 秘密库条目Type } from "@ai-life-sim/core";

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
} as const;

// ── 赊账参数：王掌柜垫 8 文等值酒菜给林九 ──────────────────────────────────────────
export const CREDIT_AMOUNT = 8;
export const CREDIT_REASON = "赊账·酒菜";

// ── 货币单位（显示用后缀）：规范单位「文」，与 CANONICAL_UNITS / index.ts 账面打印一致 ────────────
export const CURRENCY = "文";

// ── 秘密库（知情过滤 filterSecretsForPOV 的输入）────────────────────────────────
// 字段严格对齐 @ai-life-sim/core 的 秘密库条目Schema（每项都有 default，但 z.infer 输出
// 型均为必存，故八个字段全部显式填写）。知情判定走 知情名单[i].对象 === povEntityKey。
// 秘密键也是稳定结构键（同 PC/NPC_WANG 的约定），导出供消费方引用，禁止散落字面量 "S1"。
export const SECRET_S1 = "S1";

const 秘密库: Record<string, 秘密库条目Type> = {
	// S1：王掌柜在后院私藏一名被官府通缉的旧友；初始仅 npc_wang 知情。
	// $谜底 = 真相层，引擎/UI 平时物理不可见，filterSecretsForPOV 永不输出给 LLM。
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
				对象: NPC_WANG, // 初始知情面：仅王掌柜（pc_linjiu / npc_hong 不知情）
				知情程度: 100,
				立场: "死守",
				掩护基调: "佯装不知，岗开话题",
			},
		],
	},
}

// ── 世界构造（每次返回全新对象，便于重放/悔棋不共享可变引用）─────────────────────
export function buildWorld() {
	return {
		全局: {
			地点: {
				[LOC_KEY]: { 名称: LOC_NAME, 描述: "清河镇运河边第一家落脚处，往来客商多、消息杂。" },
			},
			秘密库,
		},
		NPC: {
			// 主角也登记在 NPC 表里（server.ts 用 state.NPC[PC].位置 做在场判定）
			[PC]: { 姓名: "林九", 位置: LOC_KEY, 身份: "行脚客", 体质: 5, 魅力: 6, 机敏: 5 },
			[NPC_WANG]: { 姓名: "王掌柜", 位置: LOC_KEY, 身份: "悦来客栈老板", 与主角关系: "旧识，曾赊账给主角" },
			[NPC_HONG]: { 姓名: "红姨", 位置: LOC_KEY, 身份: "客栈跑堂", 与主角关系: "萍水相逢" },
		},
	}
}
