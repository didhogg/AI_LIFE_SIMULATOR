// P0-8 Batch 1: LLM 调用类型注册表骨架
// 元数据层 — 输入切片声明 / 输出 schema / 温度档 / 回退策略
// 铁律：本文件零裸 prompt 字符串；prompt 文本组装住 hosts/slice/assemble.ts
// 确定性铁律：切片注入不进指纹（叙事路径 R7-b·禁混入 gate 判定路径）

// ── 近 K 拍窗口默认值（接切片预算 6.64·参数化可配·禁写死 K）──────────────────────
export const DEFAULT_NEAR_K = 6 as const;

// ── 具名调用类型键（冻结·改键须整体替换）────────────────────────────────────────────
// schema/memory.ts 注释中已命名三类（叙事质量二审/玩家代理回复/小剧场）；
// 本层补充运行时必用的开场白叙事/主线叙事两种。
export const NARRATIVE_CALL_TYPES = {
  开场白叙事:   '开场白叙事',   // 序章加载（拒答/超时/畸形走回退链·降级直接登场）
  主线叙事:     '主线叙事',     // 主循环每拍叙事生成
  叙事质量二审: '叙事质量二审', // schema memory.ts 已冻结具名·高质量模型
  玩家代理回复: '玩家代理回复', // schema memory.ts 已冻结具名·对白
  小剧场:       '小剧场',       // schema memory.ts 已冻结具名·场景式
} as const;

export type NarrativeCallTypeKey = (typeof NARRATIVE_CALL_TYPES)[keyof typeof NARRATIVE_CALL_TYPES];

// ── 当拍 AOHP 约束（F0·B-E2-01·不进指纹·R7-b）──────────────────────────────────
/** 当拍 AOHP 约束条目（来源=当拍提案·assemblePrompt 注入 userPrompt·不进指纹）*/
export interface ProposalConstraint {
  /** 转账约束（from→to·amount·单位取 state.货币系统.基准币种） */
  transfers?: Array<{ from: string; to: string; amount: number }>;
  /** 物品流转约束（物品 id·数量·P1 扩展位·当前可传空）*/
  items?: Array<{ id: string; quantity: number }>;
}

// ── 调用类型规格（输出格式作可插拔数据项）────────────────────────────────────────────
// 截断优先级：数组靠前的切片优先被截断（低优先级 → 先截）
export interface CallTypeSpec {
  /** 与 schema.调用类型注册表Schema.上下文组装器 字段的对应注册键 */
  上下文组装器: string;
  /** 输出约束 schema ID（开放串·供结构化输出校验器按 key 查表） */
  输出schema: string;
  /** 温度（0–2·对应 schema.核心调用条目Schema.温度） */
  温度: number;
  /** 模型档位（开放串·快速/标准/高质量） */
  模型档位: string;
  /** 超时重试策略（开放串描述·禁写死秒数） */
  超时重试策略: string;
  /** 切片预算（接 6.64·参数化默认值·禁写死 K） */
  切片预算: {
    软上限tokens: number;
    /** 截断优先级（靠前=先截·低优先级） */
    截断优先级: string[];
  };
  /** 副作用级别（none=纯只读·sandbox=可回滚·irreversible=外部不可逆） */
  副作用级别: 'none' | 'sandbox' | 'irreversible';
  /** 拒答/超时/畸形时的回退链（空 = 降级兜底·不再试其他类型） */
  回退链: NarrativeCallTypeKey[];
  /** 当拍约束注入位声明（true=此调用类型支持约束注入·assemblePrompt 读此标志决定是否展开）*/
  当拍约束注入位?: {
    transfer金额: boolean;
    物品id: boolean;
    数量: boolean;
  };
}

// ── 调用类型注册表（可插拔数据项·禁写死 K 值·禁内联 prompt 串）────────────────────
export const CALL_TYPE_REGISTRY: Record<NarrativeCallTypeKey, CallTypeSpec> = {
  开场白叙事: {
    上下文组装器: 'assembler_开场白',
    输出schema:   'schema_叙事',
    温度:         0.7,
    模型档位:     '标准',
    超时重试策略: '超时30s/重试2次',
    切片预算:     { 软上限tokens: 600, 截断优先级: ['lore底层', '编年史', 'NPC记忆', '认知投影'] },
    副作用级别:   'none',
    回退链:       [], // 开场白无后续类型·直接降级登场兜底
  },
  主线叙事: {
    上下文组装器: 'assembler_主线',
    输出schema:   'schema_叙事',
    温度:         0.8,
    模型档位:     '标准',
    超时重试策略: '超时30s/重试3次',
    切片预算:     { 软上限tokens: 800, 截断优先级: ['lore底层', '编年史', '认知投影', 'NPC记忆', '近K历史'] },
    副作用级别:   'none',
    回退链:       [],
    当拍约束注入位: { transfer金额: true, 物品id: true, 数量: true },
  },
  叙事质量二审: {
    上下文组装器: 'assembler_审稿',
    输出schema:   'schema_评分',
    温度:         0.3,
    模型档位:     '高质量',
    超时重试策略: '超时60s/重试2次',
    切片预算:     { 软上限tokens: 400, 截断优先级: ['lore底层'] },
    副作用级别:   'none',
    回退链:       [],
  },
  玩家代理回复: {
    上下文组装器: 'assembler_玩家',
    输出schema:   'schema_对白',
    温度:         0.7,
    模型档位:     '标准',
    超时重试策略: '超时30s/重试3次',
    切片预算:     { 软上限tokens: 500, 截断优先级: ['lore底层', 'NPC记忆'] },
    副作用级别:   'sandbox',
    回退链:       [],
  },
  小剧场: {
    上下文组装器: 'assembler_剧场',
    输出schema:   'schema_叙事',
    温度:         0.9,
    模型档位:     '标准',
    超时重试策略: '超时45s/重试2次',
    切片预算:     { 软上限tokens: 700, 截断优先级: ['lore底层', '编年史'] },
    副作用级别:   'sandbox',
    回退链:       [],
  },
};

/** 按调用类型键查询规格 */
export function getCallTypeSpec(key: NarrativeCallTypeKey): CallTypeSpec {
  return CALL_TYPE_REGISTRY[key];
}
