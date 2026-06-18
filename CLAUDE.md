# CLAUDE.md — AI_LIFE_SIMULATOR

> Claude Code working guide. Read this fully before any edit.

## 项目
- pnpm monorepo · main 分支 · GitHub `didhogg/AI_LIFE_SIMULATOR`
- `packages/core`（确定性引擎+schema，真值层）/ `@ai-life-sim/slice@0.0.1`（demo 旁路态，非真值）
- 文游：武侠客栈 demo（PC 林九 / NPC 王掌柜·洪 / 悦来客栈）

## 命令
- 类型检查：`pnpm tsc` —— **必须先于** `pnpm test`
- 测试：`pnpm test`
- slice 调试：`DUMP_PROMPT=1 pnpm --filter @ai-life-sim/slice dev`
- 环境：node v24.14.1。沙箱内 **无 `gh`、无 `diff` 工具**；`git push` 当前 403（didhogg auth 未解，手动处理）。

## 工作纪律（硬性）
1. **一次一 Step、一次一 commit**。
2. 破坏性改动流程：**读-only 侦察 → 回报(不猜) → 玩家拍板 → 执行 → commit → 回报绿**。
3. **commit 真正落地才能勾**完成；未落地一律「进行中」。
4. `pnpm tsc` 通过后才 `pnpm test`；tsc 新增报错即停、贴出。
5. **禁个人姓名**进 commit message / 代码 / 注释。
6. 改前贴范围表（文件×改动），改后贴 `git diff --stat`。

## 当前基线（HEAD=`c9e53d5`，B5.6 done）
- `pnpm test`：**2316 passed**（47 test files）
- `pnpm tsc`：旧债 非新增即可
- `lint`：**220**（基线·零新增）
- **schemaKeys.size === 52**（RootSchema 顶层键）
- **指纹 84** · 黄金向量 **5c1d0233 / 63b3e729 / db10d5c7**（逐位恒等）
- **REPLAY-01 22 / C2 17**
- 红线 git diff 必须为空

## 🚫 确定性红线（零改动·碰到需求即停手回报）
- `engine/rng.ts`、`canonicalize`、`engine/text/fnv1a32.ts`、`fixed.ts`（定点数学）、`RING_K`
- `fingerprintManifest.ts`（取材计算）、`hosts/**`
- 禁 `localeCompare` / `Intl.Collator`；禁裸 `JSON.stringify` 进指纹；禁平台 `.normalize`（NFC 锁 15.1.0）
- 排序一律走既有码点序工具

## packages/core 结构
- `engine/`：knowledgeFilter, fingerprintManifest, rng, gate, deterministicGuard, assertFinite, text/fnv1a32, **conservation（00bb3ed·ConservationError + assertConservation 纯函数）**
- `schema/`：actor, dollar, index(顶层52键@:95), memory, preset, proposal, system, secret, org, **economy**, map, verb, governedKeySpace, whitelistDryRun, lore
- `interfaces/`：irreversibleGuard, toolCapability, securityBoundary, contentPackHash, verbSignedCodePlugin, interventionMerge, authGate, patchInvariant, keyNormalize, seatScope
- `prompt/index.ts` · `loader/{modGraph,index}` · `replay/` · `chaos/{scheduler,invariants}`

## 关键 loci
- 账本 per-entity（2357afb 已落）：`economy.ts:81` `账户:z.record(z.string(),账户Schema).default({})`；账户Schema 字段 `:31/:32`（**当前无应收·批 B 待加**）
- migrate backfill：`migrate.ts` ~:1159(链末)·:372-413·:700·:1078/:1094·:1084-1086
- whitelist probe：`whitelistDryRun.ts:236`（walkSchema:140）
- schema.test：`:2708` schemaKeys===52 · `:3128` BLUEPRINT_KEYS
- 键卡口：`keyNormalize.ts:87`(读)·:142(写·B5 Defer)；`governedKeySpace.ts:34`(JS保留键黑名单)·:172-186(S2仲裁4项+母题)
- 席位：`actor.ts:525-532`（焦点角色键·528 NPC键指针）；`dollar.ts:321-322`（全局回滚计数器）

## core 账户Schema 字段集（economy.ts·**B5.6 定稿**）
- 持有 / 储蓄：`Record<string,number>`（writable）
- 本期收入 / 支出：`{总额, 明细}`（writable）
- **`_负债`：`Record<string,string>`（引用串·read-only·_前缀派生）**
- **`_应收`：`Record<string,string>`（引用串·read-only·与_负债对称）**
- **`_费用`：`{总额,明细}`（accrual 流量·read-only·不进 getNetAsset）**
- 被动收入来源：`Record<string,number>`
- 资产：`资产条目Schema[]`
- `export const SINK_ENTITY_KEY = '__sink__'`（沉没账户·守恒承重·P0-7 物化）
- 详见 `docs/spec/economy.md`

## 守恒（批 A 已落·B5.6 口径定稿·P0-7 接线）
- `assertConservation(accounts, expectedNetAsset, getNetAsset): void` —— Σ全实体、throw `ConservationError`、码点序、纯函数、**debt-model-agnostic**。
- 注入式 getNetAsset = 持有 + _应收 − _负债（金额从约定库取·_费用不进·sink 纳入 Σ·接线留 P0-7）。
- **接进 runTick = P0-7**（H1 clamp 后断言·尚未做）。

## 当前批次
- **批 A ✅ `00bb3ed`**：economy export + conservation.ts + 5 单测。
- **批 B ✅ `a06152d`**：_应收 shape 加字段（引用式·backfill 幂等）。
- **B5.6 ✅ `c9e53d5`**：_负债/_应收 重命名·_费用字段·SINK_ENTITY_KEY（_前缀双层写保护·六要素补全）。
- **次批（P0-7）**：getNetAsset 接线·assertConservation wiring runTick·双分录原子写·sink 零余额物化。

## 近期 commits
`c9e53d5`(B5.6·HEAD) · `a06152d`(批B·_応収shape) · `00bb3ed`(批A守恒core) · `2357afb`(per-entity迁移) · `7ae2f3b`(GW) · `c185dd6`(闸二全清) · B1-B5: `5caaac9`→`03d502c`→`9e1c830`→`acd5f07`→`ef9e570`

## world.ts exports
PC=`pc_linjiu` · NPC_WANG=`npc_wang` · NPC_HONG=`npc_hong` · LOC=`loc_yuelai_inn`(悦来客栈) · SAVE_SEED=42 · RECIPE_KEY=`chk_persuade_credit`{dc:12,attrBonus:6} · CREDIT_AMOUNT=8 · CURRENCY="文" · INITIAL_BALANCES PC:30/WANG:200/HONG:0(=230)