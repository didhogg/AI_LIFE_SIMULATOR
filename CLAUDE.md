# CLAUDE.md — AI 文游人生模拟器 · 交接窗口（2026-06-25 22:30 更新）

> **当前前线 = 预设瘦身 arc（厚预设 → 真相⊥定义⊥装配 三层分离）。**最新基线 commit **b4682a7 · test 4280**（底座-2b 规则库双轨·全门绿）。下一步 = **阶段C 破坏式纵向迁移**（prompt 已发·见下「★ 当前前线」节）。
> ⚠ 本文件下半 §0~§10 = **前序 P0-6 收官窗口背景（test 2571·2026-06-19）**，同一 repo（golden/schemaKeys 52 一致）、仍是地基，但**非当前前线**；动引擎前按真相源重核，勿当现态。

> 本窗在 E-e/⊕/Phase L 收官基础上，再完成 **S3 写卡口（fbef62d·test 2536）+ G-a 命名空间 reconcile（reconcile-only·无 commit）+ Phase D 语义闸 Step（⑤L3 人称闸 + ②R6 能力集对齐·commit 3040f53·test 2540）**；并对 **Phase F（跳过·consumer-blocked）/ Phase H（验签+外链+子域·只读侦察·全 defer）/ Phase I（模态+盐·只读侦察·I-a 部分完结·余 defer）** 做了 triage。两个 Notion 页面（P0-6 主战场 + 补漏清单）已同步。本文件是新窗口的完整接续上下文。
> **纪律铁律：一次一 Step · 侦察（读only·回报不猜）→ 拍板 → 实装 → commit 落地才在 Notion 勾。无 consumer / 拍板前 prevent fire。**
> **单一状态真相源 = repo `docs/spec/STATUS.md`（四段：§1 NOW / §2 WELD QUEUE / §3 BLOCKED / §4 UNBLOCK HOOKS）。状态查 STATUS.md 的行（带 commit+证据），不 grep 重侦察。换窗口开场只读 §1 NOW + §2 WELD QUEUE，不重载 bug.md/handbook 全文。bug.md/handbook 降级为「规格详情」，STATUS.md 是「状态」。完结即在 STATUS.md 回填；完成下游里程碑 → 查 §4 UNBLOCK HOOKS → 把上游编号从 §3 移入 §1（替代「向上翻旧账」）。若 `docs/spec/STATUS.md` 尚不存在，先跑 Notion「STATUS 总线」规则手册页 §E 的 CC prompt 建档。维护协议 + 泳道分类律 + 反向钩子初始映射见该页。**

---

## ★ 当前前线 · 预设瘦身 arc（2026-06-25）

> 以下是**当前活跃工作**。下方 §0~§10 为前序 P0-6 窗口背景（test 2571），作地基查阅，非现态。

### A · arc 目标（三层分离）
把臃肿「厚预设」拆成正交三层：
- **真相层** = `RootSchema`（运行态·**52 键守恒**·schema/index.ts）— 不动。
- **定义层** = `内容包库` record<pack_id, 内容包>（preset/contentPack.ts）+ `规则库` record<rule_id, 规则条目>（preset/ruleLibrary.ts）。
- **装配层** = `薄清单`{packs[], rules?[], 基底版本?} + `resolve()`（preset/resolve.ts）。

### B · 已完成里程碑（含 test 数）
test 链：A0 **4161**（dd9c986）→ A1 **4191**（58d9c83）→ A2 **4222**（f64dc44·内容包库+薄清单+resolve 双轨）→ **底座-2b 4280**（b4682a7·+58·规则库双轨）。
- 底座-0~1 ✅ 脚手架 / 种子视图（seedView.ts·剥 default+递归 optional+ZodObject.passthrough fail-open）。
- 底座-2 ✅ **内容包库 + 薄清单 + resolve()**：内容包.模块种子 by `RootSchema.shape` key（**fail-closed**·顶层键∉shape 拒）·resolve 三层（①单包 key===pack_id/semver/轨道一致性 ②computeLoadOrder 自环·依赖被拒·冲突b端→墓碑 ③聚合生效中内容包集哈希）·新轨(种子视图解析)⊥旧轨叠加(直接 deepMerge·等价基准)·**双轨逐表等价已证**。
- 底座-2b ✅ **规则库**（b4682a7）：规则面=12 规则表+归并表（各 optional·种子视图组合）·规则条目={规则元数据+规则面}·`resolve(manifest,library,ruleLib?)` 第三参 optional·规则路径 gated（不传=规则成品{}·**零行为变化**·保双轨等价）·复用 computeLoadOrder·**双轨×13+整包全绿·新 resolve.ts 已逐层审计通过**。
- 底座-3 / -4 ✅（详 master list）。
- **门常量**：schemaKeys **52** 守恒（内容包库/规则库属装配层·不进 RootSchema）·BUNDLE/manifest **21/86** 不变·黄金向量 **5c1d0233 / 63b3e729 / db10d5c7 逐位恒等·勿重生成**·tsc 预存错误 12（非本轮引入）·红线 diff 0。

### C · 关键文件路径
- `packages/core/src/preset/resolve.ts`（薄清单+resolve·双轨·~320 行·**dormant·不接 runTick·不进生产路径**·待阶段C 转正）
- `packages/core/src/preset/contentPack.ts`（内容包元数据 / 内容包库 record<pack_id> / 运行种子校验 fail-closed 顶层键）
- `packages/core/src/preset/ruleLibrary.ts`（规则元数据 / 规则面 / 规则条目 / 规则库·rule_id 正则 `/^[a-z][a-z0-9_]*$/`）
- `packages/core/src/preset/seedView.ts`（种子视图·剥 default / 递归 optional / passthrough）
- `packages/core/src/preset/preset.ts`（**厚预设 玩法预设Schema:471-585**·阶段C 待切·13 规则字段+内容字段内联·家境装配包黑洞 :345）
- `packages/core/src/schema/index.ts`（RootSchema·52 键）/ `memory.ts`（mod条目 / computeLoadOrder / 墓碑库）/ `governedKeySpace.ts`（命名空间枚举 13 项 / 受治理句柄Schema:78 / 注册表:127 / 仲裁策略:151·**成员闸 fail-open·留 P0-6**）/ `actor.ts`（NpcSchema:397·立绘:419/声线:422/物品:444）/ `map.ts`（地图Schema·地点/战役/区域物价）
- `loader/modGraph.ts`（computeLoadOrder）/ `loader/semver.ts`（satisfies）/ `interfaces/contentPackHash.ts`（聚合生效中内容包集哈希）

### D · 跨模块引用教义（LOCKED·靶向逐模块查时用）
- **三桶**：① 已是指针（by-ID string·不动·至多升 typed-Ref）② 内联定义（→抽 additive 冰箱模块一次+宿主存 Ref·**无破坏式 PR**）③ 真行为耦合（靶向手术·actor 勘查=0）。
- **两图绝不混**：装载图（computeLoadOrder·**无环**·自环=墓碑）⊥ 引用图（条目 Ref·**允许环**·**惰性读时** against `成品`·不进加载序·悬空→墓碑/null 守 AA3）。**惰性加载 = LOCKED**（指针精准指向单条目）。
- actor.ts 已勘查（表A/表B 在 Notion 靶向页）：truth 层 .default 正确（剥 default 是种子视图的活）·`_幕后行动种子.类型` enum:515（报仇/告发/逃离/结盟/趋附/探查/流转潜伏）= **硬伤待改**（去枚举→作者意图条目）·factFragment 在认知档案层（truth⊥cognition·不动）。

### E · 下一步（顺序锁定·用户已拍）
1. **阶段C 破坏式纵向迁移**（prompt 已发·待 CC 回报）：C1 un-dormant resolve()→生产路径 + 删厚预设已双轨迁字段（13 规则字段→规则库 / 内容字段→内容包库·preset.ts:471-585）/ C2 migration_version+1 + 确定性 shim（厚→薄·round-trip 逐位等价）+ 判定面 golden 逐位恒等（**移动=STOP**）/ C3 红线 additive-only / C4 删家境装配包黑洞（preset.ts:345·z.array(z.unknown())·**verify-then-delete**·兄弟黑洞仅报告）。
2. **第 0 件 additive 泛型指针原语**（阶段C 后）：`引用(命名空间)` 工厂（受治理句柄Schema + brand）+ 命名空间→冰箱绑定表 + `解引用(ref, 成品)` 惰性解析器（复用 governedKeySpace·打开 P0-6 成员闸）。一次建好·后续冰箱接入 = 建 record + 宿主加一行。
3. **冰箱模块簇**（②桶·additive·no-破坏）：媒体库（吸 立绘:419 / 视觉锚定特征:421 / 声线:422）/ option_set库 / 工具库(TOOL) / 物品库 / 成就库。
4. **靶向逐模块查**（迁移后·actor 为样板）：每模块出 表A（拆出建库）+ 表B（改 Ref 引用）·残留真手术(③桶)≈0。
5. **待用户拍板**：actor 里程碑定性（作者模板→成就库引用 vs 涌现去重复）/ 案底.记录派生可行性 / 关系网双存核查 / LOD 阶段B 阈值 / 幕后种子 enum 去枚举落点。

### F · 红线（同 §6·恒定）
fnv1a32 / canonicalize / hashPresetFingerprint / fingerprintManifest / gate.ts / rng.ts（含盐通道）/ fixed.ts / computeDelta.ts / conservation.ts = 只读·禁改函数体。确定性六禁：Date.now / new Date / Math.random / window / document。黄金向量勿重生成。

---

## 0 · 角色与协作模式
- **我（Notion 窗口）= 编排/审计/拍板**：发 prompt、审计回报、在两个 Notion 页面勾销、维护本 CLAUDE.md 与 docs。
- **CC（Claude Code 窗口）= 引擎实装**：跑 Step 0 侦察、写代码、跑验收门、commit。主代理无源码读权限·一切靠 CC 侦察回报。
- **用户 = Didhogg2**，单人 vibe coding，重大不确定/破坏性迁移/拍板点/红线触碰交用户定。
- **工作流（用户强制）**：状态真相源 = repo `docs/spec/STATUS.md`（CC 维护·完结即回填 commit+证据）。每完成一项先在 STATUS.md 勾销，再 cross-check 两页（P0-6 主战场 = P06 / 补漏排程 = bugs）并打勾；不一致以 **P0-6 主战场为准**回改补漏清单。新 CC 窗口默认「状态查 STATUS.md 行、不 grep 重侦察」。docs 能我方起草就我方起草，省 CC 额度。

## 1 · 关键 Notion 页面（新窗口用标题搜索）
- **STATUS 总线（规则手册）** — NOW/WELD/BLOCKED/UNBLOCK 四段格式 · 泳道分类律 · 维护协议 · 反向钩子初始映射 · CC prompt。**配套真相源 = repo `docs/spec/STATUS.md`**（换窗口只读其 §1+§2）
- **V4.1 全架构蓝图** — 顶层设计真相源
- **P0 执行手册** — P0-1~P0-11 执行顺序
- **P0 补漏执行排程**（bugs·notion-46） — 全清单 + ❓ 阶段标注（页较大·读取会截断~25%·仅 P0-1~P0-5 段可见·P0-6/Phase H/B6 完整内容在 P06 页）
- **P0-6 五道闸主战场 + 导入闸**（P06·notion-49） — 当前主战场·active edit target·含 Phase D/F/H/I 登记块·parent = 补漏排程
- **P0-6 冻结接口清单**（notion-54·原 notion-67 占位不可解·用此 URL 或搜标题）— 命名空间 reconcile / 6.74 作者签名 / DSL v1 文法 / 确定性六禁 / AA4 defer 登记处
- **V4.1 修订决议**（口径回写处）／ **动词表 V批设计** ／ 官方源码核验 ／ 社区教程参考

## 2 · 当前进度快照（前序 arc·test 2571·已被瘦身 arc 超越·现态见顶部「★ 当前前线」节）
基线（post-M纵切·**commit b72b1d1+M-a/M-b**）：**test 2571 · tsc 28（CC 环境报 30·含 2 预存于非改动文件）· lint 220 errors · schemaKeys 52 · 指纹 84（fingerprintManifest 17 条目）· REPLAY-01 24 · C2 17 · 红线 diff 空**。黄金向量 5c1d0233 / 63b3e729 / db10d5c7（C2 chaos 校验和·逐位恒等·勿重生成）。
test 进度链：2480（⊕-4+FU a0d0389）→ 2502（L Step1 ab3bb14·+22）→ 2528（L Step2 3294a23·+26）→ 2532（E-e a67dee3·+4）→ 2536（S3 写卡口 fbef62d·+4）→ 2540（Phase D 3040f53·+4）→ 2544（G1 18c8576·+4）→ 2565（L-15 b72b1d1·+21）→ **2571（M-a mIntegration·+6）**。

### 本窗新增（按时序）
- **S3 写卡口 ✅ fbef62d（t2536）** — `checkS3WriteGate(state, log)`（migrate.ts:1171-1192·纯观测·扫 7 区受治理键空间·record 键命中 JS 保留键 → 推 MigLog{level:'error',path,msg}·**fail-open**·挂点 migrate.ts:1303→:1305·migrate() 入口 :1164·MigLog interface :22）。覆盖 S3-FU 七区·关闭 S3-FU。
- **G-a 命名空间 reconcile ✅（reconcile-only·无 commit）** — 13 命名空间核对：缔约形式=换名覆盖（标的类型）·关系类型/技能类别/部队姿态/印象意象标签=defer·**无真漏·无新增 enum**。G-b populate 待 mod 生态（path II）。
- **Phase D 语义闸 Step ✅ 3040f53（t2540·2026-06-19）**：
  - **⑤ L3 人称闸** `checkL3PersonGate(state, log)`（migrate.ts·挂 checkS3WriteGate 之后·**fail-open**·MigLog 两级：error=视角宿主含'全知'∧人称='一' ／ warn=人称∈{一,二}∧视角宿主=''·四用例）
  - **② R6 能力集对齐** `ToolCapabilityType` 5→6 项（补 `json_schema`·**纯类型·按 lore.ts 为准对齐·executor 仍 stub·零行为变更**）
  - 红线核对空·指纹 84/17 条目无变动。

### 前窗已收官（保留）
- **提案闸 ⊕-1~⊕-4 ✅**（1502a22 / 171b9b9 / 0df7c7a / 24339b5）+ follow-up ✅ a0d0389（e2e-4 收紧 + forward-only∩whitelist===∅ 防回归守卫）。
- **Phase L 论文批 ✅**（Step1 ab3bb14 / Step2 3294a23）。Notion 已勾 [x]：L-1~L-12,L-22,L-23,L-25；部分完结保留 [ ]+✅note：L-24（命名done·结构外移P0-8）/L-28（枚举done·语义判外移P0-8）/L-30（hook done·算法外移P0-10）。
- **导入闸 Phase E 侧全清**：E-a（K1/K4/K6 活线 4d55b5f）+ E-e（键名冻结 enforcement a67dee3·mod墓碑原因 enum 加'冻结键改名'第7位·复用 writeM2Tombstone）；E-b M2 / E-c C6 / E-d K5 经提案闸 ⊕-3 已 fire。

## 3 · Phase L 仍 deferred 项（各阶段·本批不碰）
L-13（recency 并入统���衰减·依赖 L-1/L-6+P0-3）/ L-14（历法权威表·P0-3）/ **L-15 三态状态机（原标 P0-4 未建）/ L-19 任务显式状态机（P0-4·依赖 L-9）** ← ⚠ **CC Phase I 侦察显示 engine/stateMachine.ts 已完整实装（非 stub·dispatch 全落·BASE/MODAL_STATES 齐）·L-15/L-19 可能已可解锁·下轮 re-triage** / L-16 叙事校验闸组边界（P0-8）/ L-17 effect 4 类+白名单（P0-4·依赖 L-9）/ L-18 纠偏模态内步骤（P0-8）/ L-20 校验闸盐隔离（P0-5·= I-b G6）/ L-21 重要度冻结进指纹（依赖 L-4·碰 fingerprint）/ L-24 结构修复（P0-8）/ L-26 最小矛盾子集闭环（P0-8）/ L-27 前置条件代码化（依赖 L-9）/ L-28 语义判（P0-8）/ L-29 两模式指派（P0-8）/ L-30 可完成性算法（P0-10）。阻塞链：L-4→L-21 ／ L-9→L-17·L-19·L-27 ／ L-1·L-6→L-13。

## 4 · 执行序与下一步
**执行序（字母≠Wave序）：C→E→F→G→D→H→I→J→K → Phase M 纵切体检。**
- C/E ✅ ／ **G ✅（reconcile-only）** ／ **D ✅（3040f53）** ／ **F 跳过**（consumer-blocked·拍板前勿 fire·详 §10）
- **H 侦察完 → verdict 全 defer**（零迁移 schema 可焊��� = 0·schema slot 全在位·余皆纯函数无窗口压力 or consumer-blocked·详 §10）
- **I 侦察完**：I-a 开场白模态边界单测 = ✅ 已完结（stateMachine.test.ts:108）；**I-a G1 元层开关走组边界 = 🟢 可做 now（唯一零迁移可焊面·仅补 test·不动 engine）**；I-b（G6 盐/出厂离场契约进指纹/第三盐）= 全 defer（rng.ts 红线 + fingerprintManifest 红线 + P0-8/P2 consumer）。
- **下一步候选**：① **G1 元层开关走组边界专项 test（实装·next prompt 已发）** → ② Phase J（docs/spec 口径回写·我方起草）/ ③ Phase K 收尾 prep（B7 Q批+V3+八场景复验）。若 I-a G1 落地后 P0-6 core 侧零迁移焊前准备见底 → 转 K 八场景或 handoff。

## 5 · 关键函数签名 / schema / 常量
- `computeDelta(state, K5DeltaEntry, lockedPaths?)`（engine/proposal/computeDelta.ts·只算不写·op set/add/sub/lock·max_delta cap·路径不存在 throw 不 auto-vivify·`_`/`$`前缀自拒）
- `setAtPath`（不可变递归 spread 写原语）
- `runProposalGate(...)`（engine/proposal/runProposalGate.ts·orchestrator·①Zod→②白名单+C6→③M3+M2 pre-check→④K5 merge→computeDelta→clampLedger 折叠→setAtPath 单次写→⑤structuredClone 原子回滚+覆写日志）
- `getM3Violation(path, op, oldValue?, newValue?)`（patchInvariant.ts:51·forward-only set newValue<oldValue 拒）
- `checkM2Violation(授权源)` + `writeM2Tombstone(记录键, pack_id?, 诊断?)`（authGate.ts·writeM2Tombstone 不写 state·留导入闸）
- `checkC6SeatScope(seatId, 席位表, targetCharKey)`（seatScope.ts·单机≤1=全权限）
- `mergeInterventionDeltas(packsInLoadOrder)`（interventionMerge.ts·clamp/lock 取严·set/delta 后载）
- `clampLedger(amount, lo, hi, label, hardHi?)`（ledger.ts:31）
- `deriveModAwareWhitelist(lor, parsedModRegistry?)`（modWhitelist.ts:37·轻轨不贡献可写键）
- `assertConservation(accounts, expectedNetAsset, getNetAsset)`（conservation.ts·纯·✅00bb3ed·接 runTick=P0-7）
- `normalizeRegistryKeyNames` / `assertGovernedKeysNormalized`（keyNormalize.ts）·`是JS保留键()`（governedKeySpace.ts:36）+ 路径段正则 `/^[\p{L}\p{N}_]+$/u`（:51）·禁第二实现
- **`checkS3WriteGate(state, log)`**（migrate.ts:1171-1192·S3 写卡口·纯观测·fail-open·扫 7 区·JS 保留键→MigLog error）
- **`checkL3PersonGate(state, log)`**（migrate.ts·L3 人称闸·fail-open·MigLog error/warn 两级）
- **`computeEffectPackHash(pack: Record<string,unknown>)`**（interfaces/contentPackHash.ts:39·剔 content_hash 后 fnv1a32·可复用作 mod 单包内容哈希载体）
- **`executeVerbSignedPlugin()`**（interfaces/verbSignedCodePlugin.ts·**stub throw**·验签留 P0-6/待 crypto 路径拍板）
- **`dispatch(state, event)`**（engine/stateMachine.ts·Ring 1 纯函数·零副作用·{新机器状态,效果指令}·BASE_STATES 6 / MODAL_STATES 含 OPENING / SMEvent 30+·F1 元层写 FIFO 队列+指令组边界 flush :467-484）
- **Phase L 新增 schema（3294a23/ab3bb14）**：性格五轴.facet? optional·玩法预设 社会角色/权重/效应量 3 表（不进存档·不进 hashJudgmentBundle）·角色激活配置〔激活上限,沉默下限〕·二审维度条目.越界类型 enum〔Off-Topic,Cheating〕·动词Option.precond?+effect_decls?（.strict 内·与 side_effects 不混用）·印象条目.观测拍号?+当时快照?〔所在地点,情绪键〕+来源类型? enum·地点条目.容量?/营业时间?/活动类型?/可行走?·权重 memory.ts:32 加注「重要度·召回排序主权重」·实体模板库.NPC模板 slot·verbIntentFixture 常量
- **签名/安全边界 schema（前窗已落·待 fire）**：memory.ts:302-304 作者公钥?/签名?/签名算法?（11fc33a）+ :314 内容哈希 z.string().optional()（B1c）·actor.ts:264 主权降级 z.enum(['需确认','凌驾抢话档']).optional()·securityBoundary.ts:27-28 导出剥离敏感键 ['baseURL','apiKeyRef','modelId','protocol']（88d2b65·常量·纯函数未实装）·:36-37 主权地板事件 ['死亡','婚姻','血脉绑定','绑架','永久失核心资产']·:67-76 校验effect包过五道闸() **stub throw**·preset.ts:518-519 离场演化契约出厂模板?+org.ts:64-65 离场演化契约Schema（消费者 offstageSettler stub=P2）
- schema/常量：`_mod墓碑库`（index.ts:174 optional）·mod墓碑原因 enum（含'覆写授权越权'+'冻结键改名'第7位）·`M3_HARD_EXCLUDED_PREFIXES=['_','$']`·`M3_FORWARD_ONLY_PATHS=['编年史.序号','落账记录.序号']`·`VALID_OVERWRITE_AUTH_SOURCES=['系统','裁判','玩家确认']`·`ToolCapabilityType`（6 项·含 json_schema）·深路径 `货币系统.账户.{id}.持有.{币种}`（允许负值/透支）
- **rng.ts 盐源（红线·只读）**：盐源1 _存档头.全局回滚计数器→rerollSalt（rngFor）·盐源2 _存档头.天命重掷券使用计数→fateRerollIndex（rngForFate）·rngForTrigger·hashPresetFingerprint（rng.ts:212·签名含多 optional 参数）。第三盐（离场区间锚拍号）= 未实装·待拍板授权+P2 consumer。
- 测试入口：runProposalGate.test.ts（e2e-1..6）·replay.test.ts（REPLAY-01·正交不动）·stateMachine.test.ts（P0-4·:108 开场白硬边 / :828-860 F1 元层写排队 / :722 INHERIT 空候选）。

## 6 · 红线（恒定·绝不碰·触碰须用户拍板授权）
确定性引擎 / 指纹取材计算（fnv1a32·canonicalize·hashPresetFingerprint·fingerprintManifest）/ 结算管线（gate.ts 本体）/ RING_K / 定点数学库 fixed.ts / hosts/ / authGate.ts 本体 / **rng.ts（含 hashPresetFingerprint 整体·盐通道）**。只允许**只读调用**。黄金向量 5c1d0233/63b3e729/db10d5c7 不重生成。
- **确定性六禁**（notion-54 B区）：禁 ①Date.now/Ring0 ②D段 await ③平台超越函数 ④localeCompare ⑤裸 JSON.stringify ⑥NFC 平台 normalize。（禁②= crypto async 路径 A 入 D 段的障碍。）
- ⚠ schema 改后须 `npx tsc --project packages/core/tsconfig.json` 重编译 .js（防 stale .js 污染）。⚠ lint 假魂：`.claude/worktrees/` 下 tsc 产物 .js 触幻象 lint 错·遇到先 `git rm --cached`·baseline = 220 errors。

## 7 · 已完结里程碑（排程 checklist）
B1✅ K1 两段式加载 / B2✅ K4墓碑+K6 / B3✅ semver / B4✅ effect哈希层 / B5✅ M2/M3+S1/S2/S3+C6 / B5.5✅ 账本per-entity / 守恒core 00bb3ed / B5.6✅ 账本六要素+`_`双层写保护 / 应收 / AA4账户面+6面 / 拦截器句柄 / E-a✅ K1/K4/K6活线 / E-e✅ 键名冻结 enforcement / 提案闸 ⊕-1~⊕-4✅+FU / Phase L 论文批✅ / **S3 写卡口✅ fbef62d** / **G-a reconcile✅** / **Phase D ⑤L3+②R6✅ 3040f53**。闸二七轮全清→P0-6 解锁（c185dd6）。
- **Commits**：Phase D 3040f53(t2540) / S3 fbef62d(t2536) / E-e a67dee3(t2532) / L Step2 3294a23(t2528) / L Step1 ab3bb14(t2502) / ⊕-4 24339b5 / ⊕-4FU a0d0389(t2480) / ⊕-3 0df7c7a / ⊕-2 171b9b9 / ⊕-1 1502a22 / E-a 4d55b5f / 守恒core 00bb3ed / 签名schema 11fc33a / 安全边界 88d2b65 / S3写卡口path I 2872c24.

## 8 · 关键拍板（必记）
- **S3 拍板**：写卡口 = 纯观测 fail-open·挂 migrate semver 批后·扫 7 区·不阻断迁移（defense-in-depth·靠后）。
- **Phase D 拍板（3040f53）**：① L3 放导入闸层·与 checkS3WriteGate 同族·**fail-open**·MigLog 两级（error/warn）。② R6 **按 lore.ts 为准**补 toolCapability.json_schema·**纯类型·executor 仍 stub·零行为变更**。③ **DSL text parser（string→AST）defer 出 P0-6**（拍板3）= 共同解锁器（解锁 ① lore谓词 / ③ Y13 / D-b 层C）·v1 文法已冻·S-1 向后兼容。Defer 内容已登记排程。
- **Phase H 拍板（全 defer·park）**：crypto 路径三选一〔A node:crypto WebCrypto(async·碰六禁②) / B noble-ed25519(sync·引 npm dep) / **C 完全归 hosts（core 守零依赖·最干净·my lean）**〕— 选定前 verifySignature 不落 P0-6·且唯一 caller（导入闸）= hosts/tavern P1 未建→选哪条都不解锁 now·**park 不强决**。⑥ stripSensitiveKeysForExport 纯函数 **defer**（常量已锁=唯一 weld 面已结·无 consumer〔hosts 导出管线 P0-9/P0-11〕·后补零迁移无窗口压力·先实装=预埋错返工）。
- **Phase I 拍板**：① **rng.ts additive-only 第三盐 = 不授权·park 到 P2**（consumer offstageSettler 是 P2 stub·选授权亦无 now-value·rng.ts 是确定性脊柱·无活 consumer 先动=过早冻结+碰红线风险·待 P2 时连同 ④出厂离场契约进指纹 作一个 fingerprint-扩取材批 + 黄金向量重生成一并做）。② **G1 元层开关走组边界 test = 断言机制不命名**（用 stateMachine.ts 既有 SMEvent '元层写入' 操作标签·不硬编新语义串〔抢话/视角/观战/二审 的 canonical 串待 consumer 定·过早命名=冻���风险〕·只验 FIFO 入队→指令组边界 flush 机制）。
- **L 系列拍板**（保留）：L-4 importance=复用`权重`/L-1·L-6 五轴+facet?/L-2b 当时快照=字段白名单子集/L-3b 世界圣经=复用`_lore知识库`/L-7 激活阈值入指纹排除/L-8 越界类型 enum 扩展/L-9 precond?+effect_decls? 不扩 side_effects/L-10 复用 NPC模板 slot/L-23 纯架构隔离 defer P0-11。
- **提案闸拍板**（保留）：clamp 不进 computeDelta（orchestrator 一次性 clampLedger+setAtPath 单次写）/ 墓碑写=候选B reject-only（M2 pre-check 在提案闸·writeM2Tombstone 留导入闸）/ E-e 键名冻结→导入闸 Phase E-e。

## 9 · 待办优先级
1. **G1 元层开关走组边界专项 test 实装**（I-a·🟢 now·next prompt 已发·断言机制不命名）
2. **Phase J docs/spec 口径回写**（我方起草·省 CC 额度）
3. L-15/L-19 re-triage（stateMachine.ts 已建·可能解锁）
4. 完成每项即 cross-check 两页打勾·不一致以 P0-6 主战场为准
5. 收尾：Phase K（B7 Q批+V3+**八场景复验**）→ Phase M 纵切体检（须八场景绿后跑）
6. **P0-7**（守恒接线 getNetAsset→runTick / sink 物化只进不出 / _费用 accrual / 双分���原子写·需 runTick）— 是 Phase F 子域4 五道闸 / H⑦主权降级 / 离场补结的共同 consumer
7. **AA4 余面**：deltas.path/handlerRef registry 收紧 / null-proto 存储层 / 币种汇率行业 key / actor.ts 内部 record 面

## 10 · 为何 F/D/H/I/L 的未做项不在「八场景复验」前做（deferral rationale）
**八场景复验（Phase K）= 锁定「P0-6 导入闸 + 五道闸 weld 契约」当前态的确定性/回放/指纹基线**，不是永恒终态锁；P0-7/P0-8/P1/P2 各自带自己的 weld + 复验。未做项按三类归因，三类都安全外移到八场景之后：

- **类 A · 不碰指纹**（纯函数 / test / 运行时 fire）：填的是已在位的 schema slot 或纯逻辑，零迁移、零黄金向量影响，何时补都不动八场景基线。→ H⑥ 导出剥离纯函数、H①③ verifySignature（确定性但独立路径）、I-a G1 组边界 test、D ② executor 实装。
- **类 B · consumer 未建**（fire 点在更后阶段）：fire 进不存在的 consumer 是错的/不可能；这些 consumer 本就属 P0-6 之后的阶段——effect pack loader/runTick=**P0-7**（F-a / H⑧五道闸 / D 部分）、叙事组装器+校验闸 LLM=**P0-8**（I-b G6 盐 / L-16/18/24/26/28/29）、hosts 导入器/双宿主=**P1/P0-11**（H④⑮ 卡包 / H⑤外链 / L-23）、offstageSettler=**P2**（I-b ④⑤）。→ 它们随各自阶段 weld+复验，不属 P0-6 八场景。
- **类 C · 碰指纹但 consumer/内容契约未冻**（碰 fingerprintManifest / rng.ts 红线）：现在焊进八场景 = 过早冻结一份语义未定的契约，等 consumer 落地若契约变形指纹仍要变 → **双重返工**；故等内容契约随 consumer 冻结时，连同八场景一并重做一次。→ I-b ④ 出厂离场契约进指纹（P2 offstageSettler）、I-b ⑤ 第三盐（rng.ts·P2）、F-b/F-c rng 扩取材（effect 生产者 P0-7）、L-21 重要度进指纹（依赖 L-4·effect 活线）。

**关键安全前提**：上述所有项的 **schema slot / 常量 / 集合均已在位**（验签三字段+内容哈希、主权降级 enum+地板事件集、离场演化契约 schema、导出剥离常量、状态机 BASE/MODAL_STATES）。weld-敏感的「加约束/改 schema」部分已结，余下填充是零迁移、后补无窗口压力。因此八场景可作为 P0-6 里程碑锁先行，未做项安全后置。
