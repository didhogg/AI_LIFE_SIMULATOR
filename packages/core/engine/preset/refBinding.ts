// PR-瘦身-指针-0 · 冰箱绑定表（命名空间 → 成品冰箱 key）
// additive · dormant · 无生产消费者
// 声明 13 个命名空间的引用最终解到 成品 中哪个 record<ID,条目> 冰箱
// 待建冰箱：解析器键 = undefined → 解引用 fail-open 返 null（AA3）
// 已建冰箱：解析器键 = 成品中对应 key（resolve 产物或 RootState key）
// 纯常量·无副作用·禁 Date.now/Math.random/window/document
import type { 命名空间Type } from '../../schema/governedKeySpace.js';

export interface 冰箱绑定条目 {
  readonly 解析器键?: string;  // 成品中的冰箱 key；undefined = 待建
  readonly 描述?: string;      // 注释（阶段目标）
}

// 全 16 命名空间显式注册（封闭·与 命名空间枚举 一一对应·冰箱建立后补 解析器键）
export const 冰箱绑定表: Readonly<Record<命名空间Type, 冰箱绑定条目>> = {
  '币种':           { 描述: '待建：货币库·P3+' },
  '单位':           { 描述: '待建：单位库·P3+' },
  '稀有度':         { 描述: '待建：稀有度库·actor 物品·P0-8+' },
  '地点类别':       { 描述: '待建：地点类别注册表·map.ts·P0-8+' },
  '标的类型':       { 描述: '待建：标的类型库·P0-8+' },
  '特质子类':       { 描述: '待建：特质子类库·actor.ts·P0-8+' },
  '状态子类':       { 描述: '待建：状态子类库·actor.ts·P0-8+' },
  'sideEffect句柄': { 描述: '待建：sideEffect库·P0-7+' },
  'cascade句柄':    { 描述: '待建：cascade库·P0-7+' },
  '母题':           { 描述: '待建：母题库·P0-8+' },
  '纪元':           { 描述: '待建：历法库·P0-8+' },
  'mod包':          { 解析器键: 'mod注册表', 描述: 'RootState.mod注册表（已存在·按 pack_id 解）' },
  '拦截器句柄':     { 描述: '待建：拦截器库·P0-7+' },
  'UI组件':         { 解析器键: 'UI库', 描述: 'UI组件库·装配层·渲染面·resolve UI成品传入·不进 hashJudgmentBundle' },
  '工具':           { 解析器键: '工具库', 描述: '工具库·装配层·路由面·llm/code/roll_dice/… 按 工具ID 解·不进 hashJudgmentBundle' },
  '成就':           { 解析器键: '成就库', 描述: '成就库·装配层·定义层·按 成就ID 解·不进 hashJudgmentBundle' },
} as const;
