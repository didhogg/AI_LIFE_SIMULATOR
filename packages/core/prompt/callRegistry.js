// P0-8 Batch 1: LLM 调用类型注册表骨架（compiled JS）
export const DEFAULT_NEAR_K = 6;
export const NARRATIVE_CALL_TYPES = {
    开场白叙事: '开场白叙事',
    主线叙事: '主线叙事',
    叙事质量二审: '叙事质量二审',
    玩家代理回复: '玩家代理回复',
    小剧场: '小剧场',
};
export const CALL_TYPE_REGISTRY = {
    开场白叙事: {
        上下文组装器: 'assembler_开场白',
        输出schema: 'schema_叙事',
        温度: 0.7,
        模型档位: '标准',
        超时重试策略: '超时30s/重试2次',
        切片预算: { 软上限tokens: 600, 截断优先级: ['lore底层', '编年史', 'NPC记忆', '认知投影'] },
        副作用级别: 'none',
        回退链: [],
    },
    主线叙事: {
        上下文组装器: 'assembler_主线',
        输出schema: 'schema_叙事',
        温度: 0.8,
        模型档位: '标准',
        超时重试策略: '超时30s/重试3次',
        切片预算: { 软上限tokens: 800, 截断优先级: ['lore底层', '编年史', '认知投影', 'NPC记忆', '近K历史'] },
        副作用级别: 'none',
        回退链: [],
    },
    叙事质量二审: {
        上下文组装器: 'assembler_审稿',
        输出schema: 'schema_评分',
        温度: 0.3,
        模型档位: '高质量',
        超时重试策略: '超时60s/重试2次',
        切片预算: { 软上限tokens: 400, 截断优先级: ['lore底层'] },
        副作用级别: 'none',
        回退链: [],
    },
    玩家代理回复: {
        上下文组装器: 'assembler_玩家',
        输出schema: 'schema_对白',
        温度: 0.7,
        模型档位: '标准',
        超时重试策略: '超时30s/重试3次',
        切片预算: { 软上限tokens: 500, 截断优先级: ['lore底层', 'NPC记忆'] },
        副作用级别: 'sandbox',
        回退链: [],
    },
    小剧场: {
        上下文组装器: 'assembler_剧场',
        输出schema: 'schema_叙事',
        温度: 0.9,
        模型档位: '标准',
        超时重试策略: '超时45s/重试2次',
        切片预算: { 软上限tokens: 700, 截断优先级: ['lore底层', '编年史'] },
        副作用级别: 'sandbox',
        回退链: [],
    },
};
export function getCallTypeSpec(key) {
    return CALL_TYPE_REGISTRY[key];
}
