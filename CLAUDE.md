# CLAUDE.md — AI 文游人生模拟器 V4.1 · 交接窗口（2026-06-29 更新）


禁令：**严禁硬编码**任何数据**！！（如把“文”这个货币死焊进系统里是绝对绝对错误的！！）你每次要焊死任何变量数据前必须马上停手并向我汇报！！**严禁**为了通过测试改变量焊死变量，你一旦有任何想要通过改变量焊死数据的念头，立刻停止！！向我汇报！！禁止枚举特例化！！禁止默认值焊死让整个模块必须实体化！所有模块遵循随拆随用原理，拆了绝不实体化！严禁复杂化冗余化代码！！所有可以普世化泛化的功能任务，严禁先枚举几个小任务硬编码然后再普世化，要做全功能可用的任务就用通用模版全模块做，严禁“先硬编码再泛化”！！禁止“分批挂载”！！禁止“先做几个小任务，后面再普世化”！！禁止枚举和功能堆叠！！禁止把简单的问题复杂化！！禁止把已经可以做完的本阶段功能“故意拖延到下一阶段”！！审计的时候禁止“先定性再验证”！！必须先做全量收集，再分类、再归纳，而不是凭印象写报告！！严禁把中文日文字符混合输入文档/代码！！

问题1：（你纠结任何事情之前第一步）这是个事实（引擎负责）还是个认知（渲染层（LLM/UI负责））？是事实就进指纹层，引擎功能负责，是认知就涉及玩法/渲染。注意很多涉及认知层的东西本身就是一个给mod作者决定的**玩法**，不要自己瞎想，硬要思考怎么限制别人认知层玩法把别人的玩法自由抢过来塞进引擎的机械判定里自己设限
问题2：（你先要加任何新功能之前）你有没有想当然了纯在凭直觉说话？是不是在凭印象说话评估，根本没有查过真实的代码/文档？你有没有主动加一个根本没有用的新功能？它有没有冗余？是不是枚举项目？精简吗？别的变量里是不是做过了？跟它重复打架吗？有没有功能性/与其他变量的联动性最强？泛化性是不是最强，还是它只适用特定情况？是不是一直在往一个架构上堆枚举项目小功能？

问题3:（你在提出任何提案之前，先问题1，2，再到这一步）有没有重视玩家主权？（注意：这里的玩家主权有两个角色：mod制作者是规则的**制定者**，拥有最大**规则制定的**主权（在不坏档，破坏引擎根本机制的条件下），玩家在mod制作者的**框架**下游玩，享受在mod作者的框架下的主权，这才是游戏的**真谛**）是不是在硬掰限制玩家自由？有没有考虑到玩家游玩体验舒适度的第一性原则？你有没有模拟过一遍玩家到底会怎么操作？怎么使用游戏的某一功能？是不是你自己在臆想出来的某个玩家根本不会用的新功能里转圈？（硬掰是指：引擎在主动的检测并修正玩家想做的自由行为，并把它们硬掰进一个有限的固定的选择框架下）

问题4：（你 commit 任何「删焊死/去枚举」改动之前的最后一步 · 见 §E 反焊死验证协议）你确定这是**删除**而不是**把焊死搬到另一层**伪装成删除吗？（per-verb switch → verbDelta 取反 → executor 取反，是同一个焊死换三层皮，CC 连犯三轮）你**全仓 grep 自证**过了吗（`opposite` / `-数值` / `取反` / `- *数值槽` 在提案·executor 域零命中）？符号是**逐腿从上游（option.params / 记账AI 声明）原样搬运**、引擎层零取反零派生吗？你的测试**有没有把焊死写进断言坐实它**？有没有**覆盖到会暴露焊死的那个 case**（同向 +/+、三方 Σ=0，且走**可疑的那条真实路径**端到端，而不是 free-text 或同路径冒充）？

> **当前前线 = 硬编码清零 arc（notion-448 审计台账）+ 上下文组装器实装（notion-478）。**最新基线 commit **01b1f19 · test 5712**（R9 verbDelta 漏账 + 位置反向焊死彻底拔除·全门绿）。
> 进行中：**F4 全公式点一次性接线收尾 → R2 枚举表泛化**（清干净再开下一段·见「★ 当前前线」C 节）。
> ⚠ 旧版本 CLAUDE.md 的「预设瘦身 arc / P0-6 五道闸 / STATUS.md 总线」是**更早的地基**（test 2571/4280·schemaKeys 当时 52），仍是 repo 历史，但**非当前前线**；动引擎前按真码重核，勿当现态。schemaKeys 现为 **54**。

---

## ★ 当前前线 · 硬编码清零 + 上下文组装器（2026-06-29）

### A · 路线图（顺序锁定·用户已拍·06-28）
① 货币（A done / B 层预设迁移 deferred）→ ② **硬编码层清零（notion-448·R 系列 + F 公式 override 系列 + 🔬 全仓审计批）** ← 当前 → ③ **上下文组装器实装（架构 notion-478·记账AI §10 已落·verbDelta 翻译层已并行完成）** → ④ 预设 PR 迁移 → ⑤ 词释层 → ⑥ 涟漪 / 幕后。

### B · 已完成里程碑（notion-448）
- **R 系列（硬编码/枚举去除）**：R4/R5/R6/R7/R8 ✅ · **R9 ✅（commit 01b1f19·见 §5 编年）**。残：R2（枚举/字面量残项）· R3（motivationValidator/narrativeValidator 退回认知层）。
- **F 公式 override 系列**：F1/F2/F3 ✅（substrate 建成：`FORMULA_REGISTRY` + `resolveFormula` + `resolveEffectiveFormula` 三态 + DSL 串轨 evalExpr）。残：**F4（全公式点收尾·进行中）/ F5（机测）**。
- **🔬 全仓变量模块审计批**：Batch29–41a 已结（衰减/公式核/货币孤儿等逐批闭环）。
- **组装器（notion-478）**：§0–10 架构落定 · §10「变量模板驱动·记账AI 上下文组装」已写入（核心教义见 §E5）。

### C · 进行中（本段任务·按依赖序·禁堆叠）
1. **F4 · 全公式点一次性接线收尾**（CC prompt 已发）：剩余可调公式点全部接现有 `resolveFormula('key', formulaConfig)` substrate（economyEngine 有效价格形状走 DSL 串轨 + clamp 上下界 / beliefDerive 推理阈值 60 / narrativePullback 0.7）；netAsset 净资产**会计恒等式判 🟢 引擎事实·不加 override 通道**；relationGraph 5 常量 Batch38 已接·仅 grep 复核。每点 `defaultValue=现硬编码`→0 重定基；删孤儿字面量单一真相源。**排除**：netAsset BASE_CURRENCY / chineseNumber 币种单位（→ B 层预设迁移延后）。
2. **R2 · 枚举表泛化**（F4 热验证清干净后开）：record<键,值> 泛化 + 消费侧读作者表。清单：knowledgeWrite `KNOWLEDGE_CONSUMER_REGISTRY` 玩法名 / economyEngine '交战' 消费侧 / itemCharStateInvariant L-15 状态名 / `EMOTION_DIMENSION_MAP` / `EDGE_TYPE_IC_RATE` / `SCENE_PROPAGATION_COEFF` / `COMPLEX_CONTAGION_LABELS` / combatResolver 五档 / `ToolCapabilityType` / securityBoundary 主权地板 / LOD scheduler enum / `deriveThresholdCount` / tick.ts 消费侧魔数+边类型字面量 / time.ts 粒度键集。

### D · 提案 / 公式 substrate（教义·LOCKED·靶向时查真码）
- **公式 override 三态**（resolveEffectiveFormula）：作者 `false` 红线（禁用）> 玩家/作者 override（preset 数字轨 或 DSL 串轨）> 引擎默认。`FORMULA_REGISTRY` = 中性 O(1) record 查找，**禁 switch/case 把魔数搬进 registry**。DSL 串经 `evalExpr`，非法串 fail-safe 回默认公式（不崩）。
- **提案数据流**：`option` →（executeActionOption）→ `指令信封{provenance, 提案批[]}` →（deriveVerbDelta）→ K5 delta packs →（runProposalGate 五闸）→ computeDelta → setAtPath 原子写。两路入口：optionSetInput（菜单路径）/ injectedEnvelope（直注）。生产调用点 tick.ts:448。
- **符号来源律（R9 命门·见 §E）**：每条腿的正负号**由 `option.params.对手方条目` 携带**（菜单生成器 / 记账AI 声明），executor 与 verbDelta **只忠实复制**，引擎任何层零取反、零派生。守恒 Σ=0 由 `conservation.ts` / 闸④**校验**，**绝不由 translator/executor 生产**。
- **真码事实**：方向槽枚举 5 值=['转账收支方向','缔约方角色','关系极性','主被动方','秘密涉事方角色']=**方向角色类目（CATEGORIES）非运算方向**；运算方向须由变量类型 / 记账AI 符号派生，**不得**反推成 `-数值`。
- **变量即可改范围（§10 用户原话·治 R9 病根）**：不要每个动词写死 `effect_decls`。让记账AI 从变量模板里自动看到当前实体有哪些变量可改；上下文组装器把变量模板列表喂给 AI，AI 自然只生成引用这些变量的提案。变量存在本身就是可改范围，不需要在动词里重复声明。

### E · 反焊死验证协议（铁律·CC commit「删焊死/去枚举」前强制走完）
**1. 焊死会「搬家」伪装删除——删除 ≠ 搬到另一层。** R9 同一个「位置反向焊死」换三层皮连犯三轮（§5 编年）：per-verb `effect_decls` → verbDelta `const opposite=-数值` → executor `数值槽:-数值槽` 逐实体取反。每轮 CC 都声称「已删」，实则下沉一层。
**2. commit 前全仓 grep 自证（强制门）：** 在提案 / executor 域 `grep -nE 'opposite|取反|-数值槽|- *数值'` → **零命中**。合法误报须显式标注（如 tick.ts `oppositePolarity` = 印象极性正负切换·与提案系统无关）。
**3. 符号来源律：** 符号逐腿从上游（option.params / 记账AI）原样搬运，引擎层零取反零派生；守恒由闸④校验非生产端产生（见 D）。
**4. 测试三铁律（防造假/防坐实/防漏覆盖）：**
   - ❌ **禁把焊死写进断言坐实它**（如 `expect(提案批[1]).toBe(-50)` 把取反锁死成「正确」）。
   - ✅ **必须覆盖会暴露焊死的 case**：同向 +/+（旧焊死会强行翻成 −）、三方 Σ=0、转移付方负腿——且经**可疑的那条真实路径**端到端（option→runTick），不是 free-text、不是同路径冒充。
   - ❌ **禁 same-path 冒充**（如 8 动词全走货币路径冒充覆盖）；❌ 禁只走 free-text 不走 option 路径。
**5. 主代理验收（我）不接受 CC 纯文字声明：** 必须 CC **上传真码 + 测试文件**，我沙箱热验证四件事：①真实数据流路径确实改了 ②测试覆盖真实变量域（非冒充）③测试没把 bug 写进断言 ④测试覆盖了暴露 bug 的 case。全清才在 notion-448 勾选；**禁勾部分/捆绑任务**。

### F · 红线（恒定·绝不碰函数体·触碰须用户拍板）
`fnv1a32` / `canonicalize` / `hashPresetFingerprint` / `fingerprintManifest` / `gate.ts` 本体 / `rng.ts`（含盐通道） / 定点数学 `fixed.ts` / `computeDelta.ts` / `conservation.ts` = 只读·禁改函数体。**确定性六禁**：①Date.now/Ring0 ②D 段 await ③平台超越函数 ④localeCompare ⑤裸 JSON.stringify ⑥平台 NFC normalize。黄金向量 `5c1d0233 / 63b3e729 / db10d5c7` 逐位恒等·**勿重生成**。

---

## 0 · 角色与协作模式
- **我（Notion 窗口）= 编排 / 审计 / 拍板**：发 CC prompt、沙箱热验证 CC 回报、在 Notion 审计台账勾销、维护本 CLAUDE.md 与 docs。主代理**无 repo 源码读权限**，一切靠 CC 上传 + 我沙箱热验证。
- **CC（Claude Code 窗口）= 引擎实装**：跑 grep 侦察、写代码、跑验收门、commit、回传真码+测试供热验证。
- **用户 = Didhogg2**（cai-yijia-fm@ynu.jp · Asia/Tokyo），单人 vibe coding。重大不确定 / 破坏性迁移 / 拍板点 / 红线触碰交用户定。
- **工作流铁律**：讨论 → 拍板 → 实装 → 沙箱热验证 → 归档勾选。**不给用户调查内容，直接给拍板提案**；按依赖序拆任务，禁多页散任务、禁堆叠、禁加无用澄清行（直接改原错任务）；完成全打勾、禁勾部分。**禁用 ask-survey，直接拍板散文。** 每次提任何提案 / 做任何东西前先复核「禁令 + 问题1/2/3/4」并汇报「我看过了」。docs 能我方起草就我方起草，省 CC 额度。回应用中文、性别中性。

## 1 · 关键 Notion 页面
- **🚑 硬编码任务页（notion-448 · THE 固定审计台账·当前主战场）** uuid `38db7725263c80b6a65dd9e2d2ebbf22`：R1–R9 + 🔬 审计批（Batch29–41a）+ 🧮 公式 override（F1–F5）。R9 段含 🩸触发 → 三条 🟥 驳回（0f8a1a8/973966d/6a861be）→ 🟢 01b1f19 验收 callout。
- **上下文组装器架构页（notion-478）** uuid `29845c12875a41fc8d0c77cf72d87076`，parent = notion-5：§0–10·§10 callout = 变量模板驱动（记账AI 组装）。后续 ③ 实装的真相源。
- **主路线图** `b8a3b18744854f8dad7ca617730e2df3`（🧩）· **全架构蓝图** `98a02170416943b780cbc8ae1e0a6f67`。
- **词释层** `1441bc659ec74ab58e956ea61621e93a`（🗣️·勿重建）· **动词表** `732c2315e4834e02bccb1cca237be022`（10 动词冻结）。
- **涟漪** `a11bc54017ec43bfa028dc0ddc09ca69` · **幕后** `c7b387b9b36d4d16882d6154464f6c64`。
- **预设重构 v2** `0d1f8c1272f941ffa4964012f20a662d` · **LOD** `897eae2747cc42fdb86481b888bed041` / **LOD 动态阈值** `d36050985d7d40f28ed2835e01570edf`。
> loadPage 不接受裸 UUID·用完整 notion.so URL 或压缩句柄。

## 2 · 不变量 / 门常量（commit 必报）
- schemaKeys **54** · FORMULA_REGISTRY **44** · test **5712**（01b1f19·上轮 5704·+8） · manifest **89**（曾 87·test 断言 89）。
- BUNDLE **21** / PRESET **11** / SNAPSHOT **5** · tsc 基线 **15**（非本轮引入） · chaos **17/17** · REPLAY-01 **24/24** · fingerprint **128/128**。
- 黄金向量 `5c1d0233 / 63b3e729 / db10d5c7` 逐位恒等·勿重生成。`defaultValue=现值`→**0 重定基**。
- ⚠ schema 改后须 `npx tsc --project packages/core/tsconfig.json` 重编 .js（防 stale .js 污染）。`.claude/worktrees/` 下 tsc 产物 .js 触幻象 lint·遇到先 `git rm --cached`。

## 3 · 关键函数签名 / schema（靶向时以真码为准）
- **`deriveVerbDelta(envelope, state, _seatId)`** → `ReadonlyArray<ReadonlyArray<K5DeltaEntry>>`（verbDelta.ts）：读 `envelope.提案批`；逐条 targetPath=提案.目标引用·数值=提案.数值槽；`makeEntry(path,数值)`：非整数/0 → null·`op=数值>0?'add':'sub'`·value=`Math.abs`。**无 opposite / 关联实体 / switch（R9 后 CLEAN）。**
- **`executeActionOption({chosenOptionId, optionSet, chosenTarget?, chosenValue?})`** → `{matched, downgrade, envelope?, failure?}`（aohpExecutor.ts·post-01b1f19·FIXED）：Step5 `对手方条目=Array.isArray(params['对手方条目']).filter(type-guard {目标引用:string,数值槽:number})`；Step6 primaryEntry `{动作类别:verb,目标引用:resolvedTarget,数值槽?,方向槽?}` + `for(counterpart of 对手方条目) push({动作类别:verb,目标引用:counterpart.目标引用,数值槽:counterpart.数值槽})` ← **逐字复制·无取反**；Step7 `provenance:'player_option'` + safeParse。
- **proposal.ts**：`提案单条目Schema={动作类别 default'', 目标引用 default'', 数值槽 number?, 方向槽 enum?}.strip()`（**关联实体已删**）· `指令信封Schema={txn_id?,提案血统?,转域续命授权?,provenance? enum[player_option|player_freetext|system_cheat],提案批}.strip()` · `ActionOptionSchema={option_id,tool_name default'',params record default{},value_slot?,target_choices[] default[],min?,max?}.strip()`。
- **`computeDelta(state, K5DeltaEntry, lockedPaths?)`**（红线·禁改）：只算不写·op set/add/sub/lock·max_delta cap·validatePath（`_`/`$`前缀拒·JS 保留键拒·路径不存在 throw·no auto-vivify）·add/sub 强制整数·op 由 caller 显式·纯函数。
- **`assertConservation(accounts, expectedNetAsset, getNetAsset)`**（红线·domain-AGNOSTIC）：tick.ts Phase9 仅对 `货币系统.账户` + preNetAsset。
- **`resolveFormula('key', formulaConfig)` / `resolveEffectiveFormula`**（三态·见 §D）；formulaConfig 由 `$AI创作状态.公式override表` 构建。
- **`runProposalGate(...)`**：两路（optionSetInput→executeActionOption→envelope ／ injectedEnvelope 直注）→ deriveVerbDelta → packs → 五闸 → computeDelta → setAtPath 原子写 + structuredClone 回滚。
- **verb.ts**：动词Id 枚举 10 冻结 ['转移','缔结','解除','赋予','剥夺','调整','披露','移动','施加','植入']·`动词Option基础Schema={side_effects?,标的类型?,precond?}.strict()`（**无 effect_decls**）。
- **interventionMerge.ts**：`K5_DELTA_OPS=['set','add','sub','clamp','lock']`·`K5DeltaEntry={path,op,value,max_delta?}`。
- 其他闸：`checkC6SeatScope`（单机≤1=全权限）· `checkM2Violation`/`writeM2Tombstone`（authGate·VALID_OVERWRITE_AUTH_SOURCES=['系统','裁判','玩家确认']）· `getM3Violation`（patchInvariant·M3_HARD_EXCLUDED_PREFIXES=['_','$']·M3_FORWARD_ONLY_PATHS=['编年史.序号','落账记录.序号']）· itemCharStateInvariant **L-15**（已故→在世须 hasRevivalFlag）· `deriveModAwareWhitelist`。
- **DSL**（限深 1·无 not/has·in 只解析·路径≤2 段·空串 fail-closed）。`accounting.ts` ACCOUNTING_SYSTEM 3 类{transfers,checks,knowledge}（漏调整→好感度·单位'文钱'待货币 registry·属 B 层）。

## 4 · 关键拍板（必记）
- **R9（01b1f19·已验收）**：正确解 = 每条腿符号独立由 option.params 携带（菜单/记账AI 声明），executor 只忠实复制；守恒由闸④/conservation.ts 校验，不由 translator/executor 生产。E-2 array 是正确底座。**禁 per-verb effect_decls 焊死·禁位置反向（任何层·禁「搬到另一层」充当删除）。**
- **F4**：会计恒等式（netAsset 净资产）/ 分值域边界（clamp 0~100）= 引擎事实层 🟢·**不加 override 通道**（禁过度泛化·同 decay 死函数既裁）；真·可调公式才接 substrate。币种单位泛化（netAsset BASE_CURRENCY / chineseNumber）属 **B 层预设迁移·延后**。
- **§10 记账AI 组装**：变量存在=可改范围·上下文组装器喂变量模板·禁动词重复声明 effect_decls。
- **历史地基拍板**（仍有效）：S3 写卡口纯观测 fail-open；提案闸 clamp 不进 computeDelta（orchestrator 一次性 clampLedger+setAtPath）；墓碑写=候选 B reject-only；惰性加载 LOCKED（装载图无环⊥引用图允许环）。

## 5 · R9 焊死搬家编年（教训样本·勿重蹈）
同一个「关联实体位置反向焊死」连犯四轮，每轮 CC 声称已删实则下沉一层：
- **0f8a1a8（首版·REJECTED 🟥）**：per-verb `effect_decls`（EffectDeclSchema 逐动词）违 §10 + 禁枚举 + 禁第二实现；只走 player_option·free-text return[]。
- **973966d（重做·REJECTED 🟥）**：effect_decls 清零，但 verbDelta `const opposite=-数值` 新焊死 + 8 动词全用货币路径冒充覆盖（测试造假）+ conservation.ts 未热验。
- **6a861be（三轮·REJECTED 🟥）**：verbDelta/proposal/conservation 真对，但焊死**搬家**到 aohpExecutor `数值槽:-数值槽` 逐实体取反 + 测试 `expect(提案批[1]).toBe(-50)` 把取反**坐实进断言** + 零 option 路径同向/三方覆盖。
- **01b1f19（redo-v4·ACCEPTED 🟢·热验证拔除）**：executor Step6 `数值槽: counterpart.数值槽` 逐字复制（零取反）；全仓 grep 取反零命中；测试重写（6b 同向 asserts +10 = killer test·6c 三方 Σ=0·optionSetIntegration 经 runTick 端到端）。位置反向焊死在每一层都死。
**核心教训**：① 焊死可「搬到另一层」伪装删除 → 必全仓 grep + 逐层读真码。② 测试可「坐实」焊死 → 必查断言是否锁死焊死 + 是否覆盖暴露焊死的 case（同向/三方经可疑路径）。③ same-path 冒充 = 造假覆盖。④ CC 纯文字声明不可信，必上传真码+测试沙箱热验证。
