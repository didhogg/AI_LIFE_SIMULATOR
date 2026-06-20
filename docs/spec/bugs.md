# P0-11 探雷轮 · 探雷报告

> 探雷日期: 2026-06-21  
> 场景数: 3 · 总拍数: 8 · LLM 降级拍数: 0/8（真 LLM 出字全绿）  
> 基线: HEAD=c02ce1f → B-E2-01 patch 后 test=3385（+21）  

## 场景列表

| # | 场景 | 拍数 | 目的 |
|---|------|------|------|
| 1 | 悦来客栈/林九 | 3 | 基本叙事流 + 给钱 5文 transfer + 知情过滤 |
| 2 | NPC 情绪记忆连続 | 3 | NPC 记忆/情绪字段跨拍注入 |
| 3 | 知情过滤边界 | 2 | 自定义动作「找掌柜藏的人」+ NPC_WANG POV |

---

## Bug 清单（探雷发现）

### [B-E2-01] LLM 叙事用词与 reconcileGate 提案金额不匹配 ✅ 已修复

| 项目 | 内容 |
|------|------|
| **现象** | 场景1拍2：提案 `transfers[{from:PC, to:NPC_HONG, amount:5}]`，LLM 生成叙事含「三枚铜钱」而非「五文」，reconcileGate 返回 `hard_rejected`（期望 `covered`）。探雷首次运行触发，再次运行 LLM 生成不同文本未触发。 |
| **根因** | `UNCONFIRMED_UNIT_CHARS='块两贯吊元圆枚银铜钱'` 包含「枚」和「铜」，「三枚铜钱」hit seg2 → `isCanonicalUnit('枚铜钱')=false` → `reason='单位不可确认'` → `hard_rejected`。根本原因：prompt 未向 LLM 声明「当拍 transfer 金额=5文」，LLM 自由发挥使用非规范单位。 |
| **修复** | F0: `callRegistry.ts` 新增 `ProposalConstraint` 接口 + `当拍约束注入位` 字段（主线叙事声明 transfer/物品/数量注入位）。F1: `assemble.ts` 新增 `proposalConstraints?: ProposalConstraint` 选项 + `userPrompt` 注入`【当拍约定账变（叙事须覆盖·货币单位写"文"·禁铜钱/枚/块/两）】`段。`llmDemo.ts` 场景1拍2 补传 proposalConstraints。 |
| **单元验证** | `m_p11f1.test.ts` 21 条（F0 宣言 3 + F1 基本动作 9 + B-E2-01 复现/修复链 5 + 指纹隔离 4）全绿。reconcileGate 「三枚铜钱」→ hard_rejected 复现✓；「五文/5文」→ covered ✓。 |
| **不回归** | test 3385（+21）·schemaKeys=52·指纹 84·黄金向量恒等·红线零 diff。 |
| **修复 commit** | （待填·B-E2-01 patch） |
| **严重度** | major（已修复） |
| **归属层** | P0-8/assembler |

### [B-E2-02] 连続拍 reconcileGate 拒绝时 tick 不推进

| 项目 | 内容 |
|------|------|
| **现象** | 场景1拍2 gate=`hard_rejected` → 未调 runTick → `_tick.拍计数` 停留在 1。拍3 继续使用同一状态，历史叙事已追加但 state 时钟未同步。 |
| **疑因** | demo 设计：gate 拒绝时不 commit（与 server.ts `Z5 runTick失败回滚` 一致）。但 LLM 输出已进 histories → 历史与 state tick 不同步。 |
| **严重度** | observation（demo 级·server.ts 路径无此问题·探雷发现设计盲区） |
| **归属层** | P0-11（demo 实现需加 tick-only commit 以保持历史↔state 同步） |

---

## 验收确认

| 指标 | 结果 |
|------|------|
| web-debug 单宿主出字 | ✅ 8 拍全真 LLM 叙事（isFallback=false） |
| InMemoryArchiveStore 不落盘 | ✅（进程内 structuredClone·零 fs.write） |
| LLM 输出不进指纹 | ✅（adapter 隔离层·histories 路径·R7-b） |
| 黄金向量恒等 | ✅（LLM 输出不触碰 gate/rng/computeDelta） |
| 多场景多拍探雷 | ✅ 3 场景 8 拍 · 真 LLM 出字 |
| NPC 记忆/情绪 跨拍可见 | ✅（场景2拍1: NPC记忆注入=✓ 情绪注入=✓） |
| 知情过滤 PC POV 零可见 | ✅（场景1拍3: visible=0条） |
| $谜底 不泄漏 | ✅（场景3拍2: $谜底不泄漏=true） |
| SECRET_S1 菜单拦截 | ✅（场景3拍1: secretBlocked=true denied=1 permitted=1） |
| NPC_WANG POV S1 可视 | ✅（场景3拍2: S1可视=true） |
| 红线零接触 | ✅（gate/computeDelta/conservation/rng 函数体零 diff） |
| test ≥3342 | ✅ 3364（+22·E0 单元测试·66 files） |

## 不验项（探雷轮宽松·按拍板）

- 双机恒等（留恒等轮）
- P0-9 落盘 + 迁移实装（仅 Mock·侦察暂挂）
- NSFW Ring0/UI 接线（P1·isDebugNsfwOverrideActive 预留已就位）
