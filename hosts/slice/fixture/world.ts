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

import { RootSchema, SINK_ENTITY_KEY } from "@ai-life-sim/core";
import type { 秘密库条目Type, RootState } from "@ai-life-sim/core";
import { getNetAsset } from "@ai-life-sim/core/engine/netAsset";
import { autoCompleteRelations } from "@ai-life-sim/core/engine/relationGraph";
import { resolveOrgNodes } from "@ai-life-sim/core/engine/orgGraph";

// ── 实体键（稳定结构键）─────────────────────────────────────────────────────────
export const PC = "pc_linjiu";
export const NPC_WANG = "npc_wang";
export const NPC_HONG = "npc_hong";

// ── §九 组织实体键（C2-2 · 三类边 + 幽灵/别名/已解散防护边界）────────────────────
export const ORG_QINGHEBANG  = "org_qinghebang";  // 清河帮（顶层·外交对等端）
export const ORG_SHUIYUNHUI  = "org_shuiyunhui";  // 水运会（清河帮子级·层级边）
export const ORG_JIFU         = "org_jifu";         // 机福帮（已解散·外交边保留）
export const ORG_GHOST        = "org_ghost";        // §八①：悬空引用→幽灵节点（不进传播）
export const ORG_ALIAS_WATER  = "org_water_guild"; // §八③：水运会别名（resolveOrgNodes 归一）

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

// ── 初始账本余额（P0-7 守恒接线·与 INITIAL_BALANCES in server.ts 同口径）────────────
export const INITIAL_PC_BALANCE = 30;
export const INITIAL_WANG_BALANCE = 200;
export const INITIAL_HONG_BALANCE = 0;
// C2 carry-in：实算初始 Σ 净值（非硬编码·使用 getNetAsset 实际口径）
// golden 断言 ==230：初始账本余额漂移时模块加载即报错（防静默漂移）
export const EXPECTED_NET_ASSET: number = (() => {
	const balances: [string, number][] = [
		[PC, INITIAL_PC_BALANCE],
		[NPC_WANG, INITIAL_WANG_BALANCE],
		[NPC_HONG, INITIAL_HONG_BALANCE],
		[SINK_ENTITY_KEY, 0],
	];
	const total = balances.reduce((s, [, bal]) => {
		// getNetAsset MVP: 持有[CURRENCY] + 储蓄 + 存货估值（mock 账户对象只含持有）
		const mockAcct = { 持有: { [CURRENCY]: bal }, 储蓄: {}, 资产: [], _应收: {}, _负债: {}, _费用: { 总额: 0, 明细: {} }, 被动收入来源: {}, 本期收入: { 总额: 0, 明细: {} }, 本期支出: { 总额: 0, 明细: {} } };
		return s + getNetAsset(mockAcct as Parameters<typeof getNetAsset>[0]);
	}, 0);
	if (total !== 230) throw new Error(`[golden] EXPECTED_NET_ASSET=${total} ≠ 230（初始账本余额已漂移）`);
	return total;
})();

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

// ── 世界构造（每次返回全新对象·RootSchema.parse 填满所有默认字段·消除 TS 类型债）──
// 机敏/身份(string)/与主角关系 不在 core NPC schema 中·Zod strip 后运行时无影响。
// C2-1: autoCompleteRelations 在 parse 之后运行·生成共址/共组织双向边（G1b）。
// C2-2: resolveOrgNodes 在 parse 之后、autoCompleteRelations 之前运行（§九节点解析）。
//        组织实体/关系网 additive-only·不改 PC/NPC_WANG/NPC_HONG 字段·m_p7tier2 恒等。
export function buildWorld(): RootState {
	const raw = RootSchema.parse({
		全局: {
			地点: {
				[LOC_KEY]: { 名称: LOC_NAME, 描述: "清河镇运河边第一家落脚处，往来客商多、消息杂。" },
			},
			秘密库,
		},
		NPC: {
			// 主角也登记在 NPC 表里（server.ts 用 state.NPC[PC].位置 做在场判定）
			[PC]:      { 姓名: "林九",  位置: LOC_KEY, 属性: { 体质: 5, 魅力: 6 } },
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
		// ── §九 组织实体层（C2-2 additive·不影响 PC/WANG/HONG 的 NPC 关系图）───────────────
		// 三棵组织节点：清河帮（顶层）> 水运会（层级子级）+ 机福帮（已解散·外交边保留）
		// 每节点 {组织键, 名称, 类型, 上级组织键?, 别名键?, 状态}
		组织实体: {
			[ORG_QINGHEBANG]: {
				类型: "帮派",
				状态: "活跃",
			},
			[ORG_SHUIYUNHUI]: {
				类型: "商会",
				状态: "活跃",
				父组织: ORG_QINGHEBANG,
				// §八③ 别名：org_water_guild 将被 resolveOrgNodes 归一为 org_shuiyunhui
				别名键: [ORG_ALIAS_WATER],
			},
			[ORG_JIFU]: {
				类型: "帮派",
				状态: "已解散",  // §九 已解散：停中继（隶属边在组织关系网中保留）
			},
			// ORG_GHOST 未在此声明 → 成为悬空引用 → resolveOrgNodes 创建幽灵节点（§八①）
		},
		// ── 组织关系网（三类边填充·C2-0 留位 边类型? 字段）────────────────────────────────
		// 边 ID 格式：`{A}:{边类型}:{B}`（正典无向·A 字典序 ≤ B）
		组织关系网: {
			// ① 层级边：水运会（子级）层级隶属清河帮（母级）
			"e_shuiyun:层级:qing": {
				A组织: ORG_SHUIYUNHUI,
				B组织: ORG_QINGHEBANG,
				关系: "层级隶属",
				关系值: 60,
				约定引用键: "",
				边类型: "层级",
			},
			// ② 外交边：清河帮 ↔ 机福帮（已解散·边保留）
			"e_qing:外交:jifu": {
				A组织: ORG_QINGHEBANG,
				B组织: ORG_JIFU,
				关系: "曾经同盟",
				关系值: -20,
				约定引用键: "",
				边类型: "外交",
			},
			// ③ 隶属边：清河帮 ↔ 幽灵组织（悬空引用·§八① → 幽灵节点）
			"e_qing:隶属:ghost": {
				A组织: ORG_QINGHEBANG,
				B组织: ORG_GHOST,
				关系: "上级控制",
				关系值: 50,
				约定引用键: "",
				边类型: "隶属",
			},
		},
	});
	// §九 节点解析：别名归一 + 悬空→幽灵节点（顺序：parse → resolveOrgNodes → autoCompleteRelations）
	const resolved = resolveOrgNodes(raw);
	return autoCompleteRelations(resolved, SAVE_SEED, 0);
}
