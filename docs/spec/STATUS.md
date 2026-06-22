<!-- 执行状态看 STATUS.md，任务清单看 bugs.md。 -->
# code HEAD=c5a50b5（fix: vite.config 注入 VITE_DEEPSEEK_API_KEY·llmDemo 可出字） · 前=191dcfd（P-A-enhance-C3） · 前=fb994df（P-A-enhance-C1C2） | 焊死状态=已正式焊死 @ a7c3f69（Notion 审計签收 2026-06-19） | 更新=2026-06-22/env-fix

> 状态真相源。换窗口只读 §1+§2。规格详情查 bugs.md / P06 handbook。
> 维护协议：完结项勾掉+标 commit+test 数；下游里程碑完成→查 §4→把上游编号从 §3 移入 §1；刷新文件头 HEAD。

---

## §1 NOW（依赖序=做序·ready·非焊敏感）

- [x] G1 · 元层开关走组边界专项 test · commit=18c8576 · test=2544
- [x] L-15 · 物品/角色三态不可逆状态机（enum+谓词+Gate③-L15） · commit=b72b1d1 · test=2565
- [x] G-a · 13命名空间 reconcile（reconcile-only·无commit·无真漏·无新enum）
- [ ] J-a · docs/spec口径回写（蓝图4.x誊写/彩蛋池装配器规格/U5冻结载荷枚举/各批口径同步决议+docs） · 判据=文件提交即完·用户侧起草 · 红线?否
- [x] 八场景复验 · REPLAY-01=24 / C2=17 / 指纹=84 / 黄金向量 5c1d0233·63b3e729·db10d5c7 逐位恒等·全绿无回归 · test=2565→2571（M-a+6）
- [x] M-a · 纵切重接真接口 · commit=cd5d4fb · test=2571（+6 mIntegration）
  - world.ts/world.js: RootSchema.parse() 消除类型债（TS2345·buildWorld返RootState）
  - assemble.ts:56: 账户路径 B5.5 per-entity 修正（[pcKey].持有 而非 .持有直接访）
  - packages/core/package.json: 补3条exports（runProposalGate/computeDelta/interventionMerge）
  - mIntegration.test.ts: 6 真件集成测试（Gate①②③④⑤全路径·原state不可变·M2拒绝）
- [x] M-b · soak 300×8 全绿 · commit=cd5d4fb（同M-a批）
  - 借还闭环场景·三条守恒不变量（试算平衡/清偿能力闸/现金方向）逐位恒等
- [x] M-c · 纵切回填 · commit=cd5d4fb（同M-a批）
  - 已运行验证字段：NPC[k].姓名/位置/属性.体质/属性.魅力 · 全局.秘密库[k] 全8字段 · 全局.地点[k].名称/描述 · 货币系统.基准币种/.账户[k].持有[currency] · _系统版本/_tick
  - Gate验证路径：①信封parse(提案:{}) · ②白名单+seatId · ③M2(天命→拒绝·gate=③-M2) · ④computeDelta(add·proposedValue=150) · ④clampLedger({value,exceeded}) · ④mergeInterventionDeltas(max_delta取严=80) · ⑤原子提交(state=130·原state=100不变)
  - 黄金窗口缺口：零新增（M-a发现assemble.ts B5.5路径错误已修·world.ts类型债已清·均已在bugs.md历史记录中）
  - 场景固化：mIntegration.test.ts = slice层 fixture（REPLAY-01/C2在packages/core红线内·不新增）
- [x] M-d · 焊死信心签收 · commit=a7c3f69
  - 端到端：2571/2571 pass · REPLAY-01=24 · C2=17 · 指纹=84 · 黄金向量逐位恒等（「黄金向量·种子 1/2/3 hex 值固定」C2 测试通过）
  - 黄金窗口：零新增缺口（M-a 修复项均已在 bugs.md 历史条目中有记录）
  - 结论：**P0-6 焊死信心 ✅** — 导入闸 + 五道闸 weld 契约当前态确定性/回放/指纹基线已锁
  - 候选回报：供 Notion P06 主战场审计确认后正式焊死 → 转 P0-7-start
- [x] P0-6 DONE · 导入闸+五道闸 weld 契约正式封存 · tag=p0-6-frozen @ a7c3f69 · schemaKeys=52·指纹=84/17·黄金向量 5c1d0233/63b3e729/db10d5c7 · Notion审计签收 2026-06-19
- [x] P0-7-start Step 0 · 守恒接线侦察（只读·待拍板） · commit=—（侦察无commit）
- [x] P0-7 梯队1 · 守恒接线（slice handleAction） · commit=c09df64 · test=2589(+18)
  - getNetAsset 单币种 MVP（hosts/slice/ledger/netAsset.ts）
  - buildWorld 加 __sink__:{持有:{文:0}} + EXPECTED_NET_ASSET=230
  - server.ts 三处结算尾换接 coreAssertConservation + syncBalancesToState
  - assertSinkNotFrom 只进不出守卫 + _费用 accrual 写点
  - soak 补 core Σ守恒不变量（300×8全绿·--seed 12345 --runs 1 绿）
  - packages/core/package.json 补 ./engine/conservation 导出
  - p7conservation.test.ts 18 tests（getNetAsset/buildWorld/Σ接线/sink守卫）
  - gate.ts 零 diff · 红线 diff 空 · REPLAY-01=24 · C2=17 · 指纹=84/17 · 黄金向量逐位恒等
- [x] P0-7 梯队2 · runTick core 上提 · commit=43af2a0 · test=2624(+35)
  - packages/core/engine/netAsset.ts — getNetAsset 权威实现上提至 core（C1 defer：约定库 DSL resolver 未就绪·_应收/_应付 legs = 0）
  - packages/core/engine/tick.ts — runTick 纯函数（9 阶段显式结算序·structuredClone入口深拷·幂等·守恒·D4纪元分钟成熟锚）
  - 涟漪引擎：2-hop BFS × 衰减×信任 × covert 过滤 × 取 max 防环（$涟漪候选→认知档案·批处理后清空）
  - C2 carry-in：EXPECTED_NET_ASSET 实算（getNetAsset口径·golden断言==230·防种子世界漂移）
  - D4 术语替换：全局拍轴→全局时刻轴（blueprint/testdemo/"new handbook"/world.ts 5处·正确用法保留）
  - hosts/slice/ledger/netAsset.ts — 重导出 core 权威实现（向后兼容）
  - m_p7tier2.test.ts 35 tests（纯函数·幂等·结算序·涟漪·D4种子·守恒·50拍黄金主线·schema验证）
  - gate.ts 零 diff · 红线 diff 空 · REPLAY-01=24 · C2=17 · 指纹=84/17 · 黄金向量逐位恒等
- [x] P0-7 梯队2.5 P7-2g · slice server.ts 切换到 core runTick · commit=36a2b56 · test=2624（无新增·零回归）
  - handleAction 内嵌结算环（assertConservation/assertNetZero/assertCoreConservation）全部废除
  - 五个动作（对话/给钱/检定/还账/自定义对话）统一走 commitViaRunTick：syncBalancesToState→runTick→state 更新
  - 悔棋：还原 balances 后补 syncBalancesToState 回同步
  - 移除 coreAssertConservation 包装函数·EXPECTED_NET_ASSET/getNetAsset server.ts 内引用
  - 双路径删除 grep 确认：server.ts 内无 assertConservation/assertNetZero/assertCoreConservation 残留
  - soak --seed 12345 --runs 1 ✅ · 300×8 ✅（双轨守恒·对子+Σ 全绿）
  - gate.ts 零 diff · 红线 diff 空 · REPLAY-01=24 · C2=17 · 黄金向量逐位恒等
- [x] P0-7 梯队3 · Z3/Z5/6.67/3d 记账容错·事务保真 · commit=1fb958a · test=2656(+32)
  - hosts/slice/engine/ticket.ts/.js — TicketStore（Z5 工单冻结/6.67 幂等/3d assertNotIrreversibleReroll/replayNarrative）
  - hosts/slice/ledger/commit.ts/.js — commitWithLineage（Z3 无血统拒收+all-or-nothing预验+幂等）+ assertFullProposalConsumed（未消耗打回）
  - hosts/slice/server.ts — ticketStore/committedEvents 接入·五动作冻结+commitWithLineage·runTick 失败 rollback·悔棋解锁 eventId
  - hosts/slice/tests/m_p7tier3.test.ts — 32 tests（Z3×7 / Z5×5 / 6.67×6 / 3d×6 / 顺带单路径×3 / soak守恒×2）
  - soak --seed 12345 --runs 1 ✅ · 300×8 ✅（双轨守恒全绿）
  - gate.ts 零 diff · 红线 diff 空 · REPLAY-01=24 · C2=17 · 指纹=84/17 · 黄金向量逐位恒等
  - non-blocking defer → 梯队4：spanMinutes:240 参数化（D4 节拍源）/ C1 _应收/_应付（依赖 DSL parser）
- [x] P0-7 梯队4 · 触发/级联/并发临界·C1闭合·spanMinutes参数化 · commit=8984380 · test=2705(+49)
  - P7-4a: cascade.ts/js — J1/J6 单写者 worklist 不动点迭代·visited 防环·MAX_CASCADE_ROUNDS=8 超界 throw
  - P7-4b: snapshot.ts ObservationEntry/PendingHit 类型化·rewind.ts/js 从快照还原两表（防漂移·J2/J4）
  - P7-4c: concurrency.ts/js — ModalStackController(栈深4·epoch围栏过期作废·pop落地态兜底) + Ring2GenerationTracker(AA1世代核对·世代不匹配→弃·防双落账)
  - P7-4d: deterministicLottery(seed%candidates·可复现·禁Math.random) + IntentBarrier(全席位收齐才放行·节拍公平·flush清空下拍)
  - P7-4e: txnGroup.ts/js — V1/V6 拍首快照预求值+到达序 sortByArrivalOrder+all-or-nothing 原子提交（半组失败全组回滚）
  - C1 closure: netAsset.ts getNetAsset(acct, 全局?) — _应收/_负债 via 约定库[key].条款[0].标的(string→Number·DSL对象→0 defer P2)·向后兼容(无全局时行为不变)
  - spanMinutes 参数化：commitViaRunTick 删 :240 硬编码 → runTick 读 state.世界._本拍跨度（D4 真实节拍源）
  - soak: +runC1CovenantScenario (应收==应付 Σ守恒断言·3 assertions)·300×8 双轨全绿
  - gate.ts 零 diff · 红线 diff 空 · REPLAY-01=24 · C2=17 · 指纹=84/17 · 黄金向量逐位恒等
- [x] P0-7 梯队5 · P0-6→P0-7解锁件接线（G7/V3/effectGate+F-b/L-21/H-c-3/H-c-4/K-a·焊死级） · commit=f4570ba · test=2771(+66)
  - P7-5a: packages/core/engine/deathIntercept.ts/js — scanDeathIntercept 首命中即停·DEATH_INTERCEPT_TRIGGER='天命:生死判定'·G7硬顶
  - P7-5b: packages/core/engine/verbExpand.ts/js — expandVerbTarget Unicode码点序(*→全部·字面→单元素·空→空)·applyVerbToTargets V3写入口
  - P7-5c: packages/core/engine/effectGate.ts/js — runEffectGates 五道闸(③前缀·②白名单·④max_delta钳制·⑤原子令牌)·fillEffectPackHash F-a·computeEffectPackSetHash AA6
  - P7-5c F-b: fingerprintManifest.ts — FINGERPRINT_BUNDLE_MEMBERS 第18条 side_effects注册集（17→18）
  - P7-5c F-b: rng.ts — hashJudgmentBundle additive扩 side_effects注册集? optional·函数体零diff·黄金向量不变（Option B）
  - P7-5d: packages/core/engine/importanceFreeze.ts/js — freezeImportanceScore/assertImportanceFrozen/readFrozenScore·L-21冻结纪律（进指纹 via content_hash→聚合哈希链路）
  - P7-5d: schema/memory.ts — 記憶條目Schema 加 権重_冻結: z.boolean().optional()（additive-only·zero migration）
  - P7-5e: packages/core/engine/sovereigntyFloor.ts/js — checkSovereigntyFloor/autoFloorAuthorization/isFloorEvent·H-c-3·主权地板事件5件·凌驾抢话档授权门
  - P7-5f: packages/core/engine/covenantWrite.ts/js — Q1创建/Q2修改/Q4追加(append-only·已解除拦截)/Q6解除(幂等)·verbWriteToTargets V3写入口
  - packages/core/package.json — 补8条exports (deathIntercept/verbExpand/effectGate/importanceFreeze/sovereigntyFloor/covenantWrite/fingerprintManifest·含tick已有)
  - hosts/slice/tests/m_p7tier5.test.ts — 65 tests (DoD全覆盖·P7-5a/b/c/d/e/f各行为断言)
  - 黄金向量 Option B：C2 buildWorld() 不含effect packs → 聚合哈希='' fail-open → 三向量5c1d0233/63b3e729/db10d5c7逐位恒等
  - gate.ts 零 diff · rng.ts 函数体零 diff · 指纹=84/18(F-b+1) · REPLAY-01=24 · C2=17 · 黄金向量逐位恒等
- [x] P0-7 梯队6 · 黄批结算子项收尾（跨域/知情/Resolver/历法/断言②/AA6·穿插） · commit=0eed491 · test=2832(+61)
  - P7-6a: packages/core/engine/crossDomain.ts — makeTriTickKey/(globalTick,domainId,seedId)三元定序键·compareTriTickKeys·sortByTriTickKey·computeSupplementInterval·crossDomainOneShot(interest=principal×annualRate×durationMin/518400)
  - P7-6b: packages/core/engine/tick.ts — SETTLEMENT_PHASES加'媒介拍末取材'(9→10)·涟漪传播<媒介拍末取材<原子提交（涟漪先落账·E4·6.55）
  - P7-6c: packages/core/engine/knowledgeWrite.ts — KNOWLEDGE_CONSUMER_TYPES(即时现算/落账瞬间定格)·KNOWLEDGE_CONSUMER_REGISTRY(8条目含增审7三槽位雇主/母亲/恋人)·KNOWLEDGE_ENTRY_CHANNELS(4通道)·expandKnowledgeSelector·knowledgeWrite(写入瞬间展开·字典序)
  - P7-6d: packages/core/engine/groupAnchor.ts — pinGroupAnchor(fnv1a32·pin-once·重复throw)·assertGroupAnchorExists·verifyGroupReplayIdempotency(G3·6.49)
  - P7-6e: packages/core/interfaces/combatResolver.ts — ExternalRoundEvent接口(eventId/type/payload/roundIndex)·step()第三参升级ExternalRoundEvent[](P7-6e R3·签名冻)
  - P7-6f: packages/core/engine/time.ts — isNaturalMonthBoundary+computeCalendarContinuation(即时+5/日常+1440/月→nextMonthStart/年→nextYearSameDay)·N-7 modelId单写已确认(✅077f3c7)
  - P7-6g: 同state同tickId双跑→verifyGroupReplayIdempotency=true(断言②F1组内隔离实证)·AA1世代号核对(Ring2GenerationTracker·世代不匹配→弃)·runTick幂等门
  - P7-6h: AA6负向控制 — 改effectPack内容→content_hash变(正向)·改无关state字段→effectPackSetHash不变(负向)·双跑逐位恒等
  - hosts/slice/tests/m_p7tier6.test.ts — 61 tests (P7-6a/b/c/d/e/f/g/h DoD全覆盖)
  - m_p7tier2.test.ts SETTLEMENT_PHASES.length 更新(9→10·hardcoded count同步)
  - gate.ts 零 diff · rng.ts 函数体零 diff · 指纹=84/18不变 · schemaKeys=52不变 · REPLAY-01=24 · C2=17 · 黄金向量逐位恒等
  - soak --seed 12345 --runs 1 ✅ · 300×8 ✅（双轨守恒全绿）
- [x] D-a · DSL v1.0 string→AST parser实装 · commit=ee67ef5 · test=2926(+94)
  - packages/core/engine/dsl/parser.ts — 递归下降 M·1 EBNF v1.0（tokenizer+Parser·parseExpr/parsePred/tryParseExpr/tryParsePred·DslParseError·DSL_GRAMMAR_VERSION='v1.0'）
  - 完整 token集：INT/IDENT/运算符/比较符(含'in')/逻辑词(and/or)/函数名(min/max/clamp/pow/sqrt)/EOF
  - 函数vs路径消歧：fn名后'('→call·否则→path段·中文路径 /^[\p{L}_][\p{L}\p{N}_]*/u 支持
  - 谓词限深1：首compare后遇and/or→解第二compare→再遇and/or→throw DslParseError('谓词限深 1')
  - fail-closed：空串/非法字符/未闭合括号/尾部残余 全部 throw DslParseError（tryParse* → null）
  - packages/core/engine/dsl/eval.ts — 追加 evalPredStr(src,ctx)·追加 DSL_EVALUATOR_VERSION='v1.0'·'in'→false fail-closed
  - packages/core/engine/verbExpand.ts — expandVerbTarget K-a谓词求值侧：tryParsePred+evalPred·字面键优先·无resolver时跳过
  - packages/core/package.json — 补 ./engine/dsl/parser + ./engine/dsl/eval 导出
  - tsc 零新增错误 · gate.ts/conservation.ts/rng.ts 函数体零 diff · 指纹=84/18不变 · 黄金向量逐位恒等
- [x] D-b · DSL v1文法冻结+防双轨（parse路径与fixed.ts逐位恒等） · commit=ee67ef5 · test=2926
  - 防双轨测试：pow/sqrt/min/max/clamp via parse+eval = fixed.ts 返回值逐位恒等
  - evalExpr/evalPred 全经 parser.ts 路径·禁平台 Math（六禁③）
- [x] S-1 · fixture gate（v1表达式parse+eval逐位恒等 + v2向后兼容断言）· commit=ee67ef5 · test=2926
  - 10条表达式 fixture（min/clamp/pow/sqrt·含除法/一元/嵌套）+ 8条谓词 fixture（全比较符+and/or）
  - v2向后兼容：全部 v1 fixture 在当前文法下 parse 不 throw
  - 确定性 round-trip：同 AST 双跑求值逐位恒等
  - packages/core/tests/dslParser.test.ts — 92 tests（D-a/D-b/S-1/K-a/in/版本常量）
  - packages/core/tests/fingerprint.property.test.ts — 补 DSL文法版本 bump + 求值器函数库版本 bump → 指纹变 property
- [x] D-a-lore · lore谓词冻结+受控接口能力集注册集取材+保真度落血统 · commit=1a085ce · test=2957(+31)
  - packages/core/engine/loreFreeze.ts — freezeLorePredicate/assertLorePredicateFrozen/readFrozenLorePredicate（L-21同构·创建即冻结·永不重算·fail-closed/fail-open）
  - packages/core/schema/lore.ts — lore条目Schema 加 触发谓词_冻结: z.boolean().optional() + _导入保真度: z.enum(['compat_strict','compat_plus','native']).optional()（additive-only·零迁移）
  - packages/core/engine/fingerprintManifest.ts — BUNDLE_MEMBERS 18→20：'lore谓词集合'(19th) + '受控接口能力集注册集'(20th)·TODO P0-6 comment 删除·lore能力集 EXCLUDED 注释同步
  - packages/core/engine/rng.ts — hashJudgmentBundle additive扩 lore谓词集合? + 受控接口能力集注册集? optional·函数体零diff·黄金向量Option B不变
  - packages/core/tests/fingerprint.property.test.ts — FullCtx +2字段·fingerprintOf spreads +2·BUNDLE_MUTATIONS +2·D-a-lore describe +5 tests（Option B双×2/非重叠/谓词内容变/新增条目变）
  - packages/core/tests/loreFreeze.test.ts（新建）— 24 tests（freeze/assert/read三件套·L-21同构纪律）
  - packages/core/package.json — 补 ./engine/loreFreeze 导出
  - runProposalGate.test.ts:609 manifest count 79→81（+2 bundle members）
  - schemaKeys=52 守恒·指纹=84/18→84/20(+2)·fingerprint property 84→94 cases·REPLAY-01=24·C2=17·黄金向量逐位恒等
  - 非重叠证明：受控接口能力集注册集（能力类型串·'code'/...）与 side_effects注册集（handlerRef串·'combat:...'）域完全分离·Gate A自动覆盖
  - 导入闸fire：defer P1（hosts/tavern consumer未建·与H-c-1/2同档）
  - gate.ts 零 diff · rng.ts 函数体零 diff · 红线 diff 空
- [x] G-b · path II populate registry (mod条目命名空间键声明) + S6未注册句柄检查 + IM3-D1 pack_id auto-enroll · commit=3f2d145 · test≈3068(+23 registryPopulate)
- [x] G-c · S2仲裁ログ onConflict + C2母题写入口注册闸(checkMotifRegistration) · commit=fd05c05 · test=3096(+19梯队C合计)
- [x] G-d-registry · 可写键路径叶段成员资格检查(checkGoverneRegistryMembership) · commit=706cd9b · test≈3077(+9梯队B)
- [x] G-e · S5规则引用完整性扫描扩维(checkDisabledRuleKeyRefs) · commit=fd05c05（同梯队C）
- [x] S6 · 受治理键空间句柄命名空间未注册检查(checkS6UnregisteredHandlerRefs) · commit=3f2d145（同梯队A）
- [x] D-2 · 散落别名归一·mod包命名空间观测（checkPackIdAliases·$隐藏记忆库.延时种子来源.包id / 行动卡库._来源包·fail-open·warn·D-3 defer） · commit=d2e1646 · test=3105(+9)
- [x] D-3 · 延时种子来源包名归一·additive backfill · commit=074b736 · test=3119(+14)
  - dollar.ts:289 延时种子.来源 加 来源包 optional（包id 保留 ≥1 版本读回退·D3c守约）
  - backfillSeedSourcePkgName：包id 非空→写来源包·包id 保留·幂等·sorted·二次no-op
  - migrateSeed:244 同时填新字段（canonPkg ?? legacyPkg fallback）
  - checkPackIdAliases 双轨：来源包(新)优先·包id(旧)回退·不双报
  - +14 tests（backfill幂等/双机恒等/二次no-op/全链端到端·双轨scan4条）
  - 行动卡侧 _来源包 保留 _ 前缀（computeDelta.ts 只读保护·改名独立批另拍板）
  - schemaKeys=52·指纹=84/18不变·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空
- [x] P0-11 探雷轮 · web-debug 真 LLM 端到端出字 · commit=f0baa77 · test=3342→3364(+22)
  - E0 InMemoryArchiveStore（进程内·不落盘·structuredClone·bumpReroll）
  - E1 LLM adapter 隔离层（callNarrativeSafe·降级路径·不进指纹·R7-b）
  - E2-E3 llmDemo.ts：3场景8拍·真 LLM 叙事出字（isFallback=0/8）·多拍历史累积
    - 场景1（悦来客栈/林九）：基本叙事流+给钱5文+知情过滤
    - 场景2（NPC情绪记忆连続）：NPC记忆/情绪字段跨拍注入验证
    - 场景3（知情过滤边界）：secretRef拦截·NPC_WANG POV·$谜底不泄漏
  - E4 探雷报告：docs/spec/bugs.md · B-E2-01(reconcileGate金额不匹配·major) · B-E2-02(tick不推进·observation)
  - schemaKeys=52·指纹84·黄金向量5c1d0233/63b3e729/db10d5c7逐位恒等·红线diff空
- [x] B-E2-01 修复 · assemblePrompt 当拍约束注入 · commit=b7dfd68 · test=3364→3385(+21)
- [x] G1a · 涟漪发射端复活（$涟漪候选→认知档案 真接线 + Phase6 关系触发 + covert 零印象） · C1=f135d63 · C2=c200582 · C3=44339d8 · test=3385→3397(+12)
  - C1(f135d63): tick.ts/.js — emitRipple()（exported·外部调用接口）· REL_RIPPLE_THRESHOLD=50 · Phase6 关系触发（NPC关系扫描·|强度|×信任/100≥50发射候选）· covert 零印象修正（if(covert)continue 移至 writeImpressionMax 前·一跳/二跳均不落认知档案）
  - C2(c200582): m_p7tier2.test.ts/.js 重定基·covert 测试3断言修正 toBeGreaterThan(0)→toBe(0)（§十三-1批一次性重定基·其余涟漪向量1/2/4/5/6逐位恒等）
  - C3(44339d8): m_g1a_ripple.test.ts 涟漪专项回归 12 tests（V1 emitRipple·V2 Phase6关系触发阈值·V3 A→B→C两跳衰减·V4 covert零印象·V5 Phase6+传播端到端）
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变·gate.ts/conservation.ts/computeDelta.ts/rng.ts/fixed.ts 零diff·tsc=29(≤30 CC基线)·lint≤220
  - 根因：UNCONFIRMED_UNIT_CHARS含「枚/铜」→「三枚铜钱」hit seg2→单位不可确认→hard_rejected
  - F0: callRegistry.ts ProposalConstraint接口 + 当拍约束注入位字段（主线叙事声明 transfer/物品/数量）
  - F1: assemble.ts proposalConstraints?:ProposalConstraint → userPrompt【当拍约定账变】段注入（5文·规范单位·禁铜钱/枚/块/两）
  - F2: m_p11f1.test.ts 21条（F0宣言3·F1基本9·B-E2-01修复链5·指纹隔离4）全绿
  - llmDemo.ts 场景1拍2 补传 proposalConstraints·再跑 LLM 应 covered
  - schemaKeys=52·指纹84·黄金向量恒等·红线diff空·prompt不进指纹(R7-b)
- [x] G1 · 涟漪空间层因子（区域图跳数 + 人口密度调制·propagateRipple 二跳接线） · C1=c5c114b · C2=bc30043 · C3=0a95fd4 · test=3397→3407(+10)
  - C1(c5c114b): tick.ts/.js — fixedPow 导入·REGION_HOP_DECAY=0.7·POPULATION_DENSITY_FACTOR(5档)·locRegion(父节点链回溯)/buildRegionGraph(全量相邻边推导)/bfsRegionHops(数组下标BFS)/computeSpatialFactor(退化=1·跨区域=decay^n×密度)·propagateRipple 二跳 obs2Loc→sfactor 接线·TODO(G2)媒介维度占位
  - C2(bc30043): m_p7tier2 5涟漪向量重定基确认（§十三-1一次性预算·全逐位恒等·无文件改动）
    - 向量2(1-hop WANG): 80(0x50)→80(0x50) 恒等（1-hop 不入空间因子路径）
    - 向量4(2-hop HONG): 40(0x28)→40(0x28) 恒等（buildWorld地図.地点={}→退化factor=1.0）
    - 向量6(takemax 豪气): 70(0x46)→70(0x46) 恒等（takemax路径无空间因子）
    - 向量1/5(empty/clear): 无强度断言 → 不变
  - C3(0a95fd4): m_g1_spatial.test.ts 空间层专项回归 10 tests（S1距离单调性·S2密度梯度·S3退化不变式·S4确定性·S5covert继承）
  - 退化路径验证：无地图(0x28=40)·单区域同区域子地点(0x28=40)·多区域1-hop同地(0x50=80)
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变
  - gate.ts/conservation.ts/computeDelta.ts/rng.ts/fixed.ts 函数体零diff·lint 0新增·tsc 0新增
- [x] G1b · 关系图自动补全（装配期共址+组织分桶→候选成对→强度叠加→seeded抖动→度数裁剪→NPC.关系[] additive写入） · C1=510f1c7 · C2=03c5799 · test=3407→3426(+19)
  - C1(510f1c7): packages/core/engine/relationGraph.ts/js — autoCompleteRelations(state,worldSeed,presetVersion)
    - COLOC_BASE=30·ORG_BONUS=30·JITTER_MAX=10·REL_TRUST=100·MAX_RELATION_DEGREE=10
    - 共址桶+组织桶分桶→正典pairKey(null-byte分隔)→候选成对→强度叠加→rngFor(装配:关系:pair,tick=0)→度数上限降序裁剪→additive写入NPC.关系[]
    - 退化守卫: NPC<2 / 无共桶候选 → 零边·state 不变
    - packages/core/package.json: 补 ./engine/relationGraph 导出
    - hosts/slice/fixture/world.js: buildWorld() 末追 autoCompleteRelations(world, SAVE_SEED, 0)
    - 共址仅边强度 max=40<50 → Phase6 score<50 不触发·既有黄金向量/指纹/schemaKeys 全恒等
  - C2(03c5799): m_g1b_relations.test.ts 19 tests（①共址生成边·②组织强度>共址·③Phase6阈值交互·④确定性逐位恒等·⑤退化不变式·⑥度数上限）
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变
  - gate.ts/conservation.ts/computeDelta.ts/rng.ts/fixed.ts 函数体零diff·lint 0新增·tsc 0新增
- [x] G1b3a · AOHP 调试控制台（web-debug 层·菜单回路接进·6 功能·零 core 改动） · C1=48fb8dd · C2=d13a01b · C3=737726f · test=3426→3467(+41)
  - 功能1 inspectMenu: 过滤前后对比·KNOWLEDGE_DENIED 原因码·denied 条目 option_id
  - 功能2 runValidationChain: 5步校验链（格式/菜单归属/知情过滤/effect闸/runTick）
    逐步可视·BAD_FORMAT/NOT_IN_MENU/KNOWLEDGE_DENIED/GATE_REJECTED/GATE_SKIPPED
  - 功能3 runTickWithDiff: structuredClone before/after·认知档案 ImpressChange·
    Phase6 RelHit（score≥PHASE6_THRESHOLD=50）·货币 ResourceChange
  - 功能4 TimeController: 固定seed重放·tickId=debug:{seed}:tick:{n}
    step/jumpTo/replay确定性·getEventLog时间日志·同seed逐位恒等
  - 功能5 runActionInDualMode: demo↔llm模式切换·forceFailure注入
    scriptedNarrative·callNarrativeSafe兜底·LLM不可用→降级不崩
  - 功能6 DEBUG_FIXTURES三规模（seed 100/200/300·严格隔离黄金seed=42）
    小城3NPC·大陆6NPC（商会→Phase6可见）·整世界12NPC·2组织
    地点数据正确存于地图.地点（全局Schema无此字段）
  - m_g1b3a_debug_console.test.ts 41 tests（T1菜单/T2拒绝链/T3通过链/T4GATE_REJECTED/T5重放/T6失败注入/T7fixture确定性/T8diff结构/T9指纹守恒）
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变
  - core 函数体零diff·lint 新文件0新增错误·tsc 新文件0新增错误
- [x] G1b3b · AOHP 调试控制台锦上添花批（POV切换/关系网图/快照回放·7功能·零core改动） · C1C2=746598b · C3=c40e800 · test=3467→3533(+66)
  - 功能1 povInspect/comparePOVs: filterSecretsForPOV路径·existence-opaque·
    onlyA/onlyB/both三分区·covert门控验证·认知档案投影
  - 功能2 buildRelationGraph: state.NPC[*].关系[]→无向图节点/边·
    score≥50高亮（isHighlighted）·组织聚簇cluster·不使用localeCompare（确定性六禁）
  - 功能3 takeStateSnapshot: 关键字段快照（tick/NPC数/边数/认知/资源/涟漪候选目标数等）
  - 功能4 buildIncrementalView: TickDiffResult[]→时间线聚合·复用G1b3a diff结构
  - 功能5 ActionRecorder: 记录option_id序列+seed·replay()逐位恒等·exportSequence
  - 功能6 SnapshotStore: 多命名快照·compare()结构化diff·changedFields字段级检出
  - 功能7 buildPCPanel/buildStateTree/buildMapThumbnail: PC关键状态面板·
    可折叠状态树·地图区域缩略图·LOD字段lodStatus=placeholder（待G7·明确灰显占位·不伪造）
  - m_g1b3b_debug_console2.test.ts 66 tests（T1-T11全DoD覆盖）
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变
  - core 函数体零diff·lint 新文件0新增错误·tsc 新文件0新增错误
- [x] G1b3c · 浏览器入口最小调试壳（web-debug Vite 6-tab UI·零 core 改动） · C1C2=f6cd9e6 · test=3533(不变)
  - hosts/web-debug/package.json: scripts dev/build/preview 接通
  - hosts/web-debug/vite.config.ts: optimizeDeps.exclude @ai-life-sim/core + define process.env={}
  - hosts/web-debug/index.html: 入口页
  - hosts/web-debug/src/style.css: 暗色主题 ~280 行
  - hosts/web-debug/src/main.ts: 6-tab 浏览器 UI（菜单/时间/关系图/POV/快照/状态树）
    - 菜单 Tab: inspectMenu 显示 + 可点击选项 → runValidationChain + runTickWithDiff + 录制
    - 时间 Tab: TimeController step/jump/replay + 时间线增量视图 + LLM/demo 切换
    - 关系图 Tab: SVG 圆形布局（确定性·无 Math.random）·score≥50 高亮（橙色·2.5px）·≥50 节点测试绿
    - POV Tab: 双视角切换 + comparePOVs diff 并排
    - 快照 Tab: SnapshotStore 存取比对 + ActionRecorder 记录/回放
    - 状态树 Tab: buildPCPanel + buildMapThumbnail（LOD 灰显占位）+ buildStateTree 可折叠 <details>
  - aohpDebugConsole.ts / aohpDebugConsole2.ts: typeof window 守卫（Node.js 直运·浏览器跳过）
  - vite build smoke: 159 modules transformed · 0 errors · 466ms
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变
  - core 函数体零diff·lint/tsc 零新增错误·test 3533 全绿不减
- [x] P-A-bug-01 · 叙事·出字面板（菜单 Tab 接入 runActionInDualMode + diff/narrative 并排） · C1C2=5603c1e · C3=4c09bb0 · test=3533→3551(+18)
  - 问题: 菜单 Tab 点 permitted 选项只跑 runValidationChain+runTickWithDiff，无叙事出字
  - C1C2(5603c1e): src/main.ts — import runActionInDualMode/ActionResult; S.lastNarrative/narrativeLoading 新增
    - [data-run-option] 点击链路: 校验通过→ async runActionInDualMode(preTick, mode, forceFailure)
    - demo 模式立即出字; llm 模式真 LLM or callNarrativeSafe 降级; 校验失败(passed=false)→lastNarrative=null→只显拒绝码
    - renderNarrativePanel(): 模式 tag(demo scriptedNarrative / llmDemo 真 LLM) / isFallback badge / usedDefault badge / prose 原文
    - renderMenuTab() 改 diff-narrative-grid 并排布局（左 State Diff / 右 叙事·出字）
    - style.css: diff-narrative-grid/narrative-col/prose-box/mode-tag/fallback-badge 等新增样式
  - C3(4c09bb0): m_g1b3c_narrative_panel.test.ts 18 tests
    - T1 demo→narrative非空/isFallback=false/optionId一致
    - T2 forceFailure→isFallback=true/usedDefault=true
    - T3 scriptedNarrative 字面恒等（UI 不改写检验）
    - T4 越权 optionId→usedDefault=true
    - T5/T6 BAD_FORMAT/KNOWLEDGE_DENIED→passed=false·无叙事路径
    - T7 叙事+state diff 并存·两轨独立（tickId 不渗漏进 prose）
    - T8 指纹84/schemaKeys52 守恒
  - vite build: 159 modules · 0 errors
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84/20不变·schemaKeys=52不变
  - core 函数体零diff·lint≤220·tsc≤28
- [x] P-A-enhance · 调试台增强批（操纵主体切换 + 自由文本 try-map） · C1C2=fb994df · C3=191dcfd · test=3551→3571(+20)
  - Feature A · 操纵主体切换
    - S.operatorKey 独立于 S.pcKey，fixture 切换时重置为 pcKey
    - inspectMenu/runValidationChain/runActionInDualMode/runTickWithDiff 全部以 operatorKey 身份执行
    - POV Tab 新增「操纵主体切换」section（selector + 重置按钮 + 状态标注）
    - 切换时清空 lastMenu/lastChain/lastNarrative/lastFreeTextResult
    - header 切换后显示操纵者警告色；菜单 section 顶部显示 operator banner
    - renderOperatorBanner(): default(绿)/switched(橙) 双态
  - Feature B · 自由文本输入框（debug 近似匹配·真词释留 G4）
    - tryMapToOptionId: exact → displayText contains → verb prefix → none
    - 匹配成功: runValidationChain → runTickWithDiff + runActionInDualMode（写账）
    - 未匹配: 纯RP 路径·仅 runActionInDualMode(scriptedNarrative=text in demo)·不写账·不驱动 runTick
    - 越权文本: chain 拒绝显原因码；__rp_only__ 作为伪 optionId usedDefault=true
    - 结果面板: 映射类型 badge(success/rp) + 叙事 prose-box
  - C3(191dcfd): m_g1b3c_enhancement.test.ts 20 tests
    - TA1×4 操纵主体切换·inspectMenu/runValidationChain 以新身份计算·PC≠NPC_WANG 知情差异
    - TB1-TB3×5 tryMapToOptionId exact/display/verb 匹配路径
    - TB4×4 无匹配→纯RP·usedDefault=true·state 不写账
    - TB5×2 越权文本→KNOWLEDGE_DENIED·纯RP 兜底叙事
    - TC×5 指纹84/schemaKeys52 守恒
  - 黄金向量 5c1d0233/63b3e729/db10d5c7 逐位恒等·指纹=84不变·schemaKeys=52不变
  - core 函数体零diff·lint+0·tsc 无新增
- [x] env-fix · vite.config 注入 VITE_DEEPSEEK_API_KEY → browser llmDemo 可出字 · commit=c5a50b5 · test=3571(不变)
  - 根因: vite.config 'process.env':'{}' → browser 端 process.env 恒空 → DEEPSEEK_API_KEY 读不到 → isFallback=true
  - 修复: defineConfig 函数形 + loadEnv → VITE_DEEPSEEK_API_KEY 注入为 process.env.DEEPSEEK_API_KEY
  - 未设 VITE_ 变量用 undefined（JSON.stringify 省略）→ adapter ?? 默认值生效
  - adapter(openai-compatible.js) 零改动
  - 新增 hosts/web-debug/.env.example（变量名 VITE_DEEPSEEK_API_KEY + 重启提示）
  - main.ts 降级文案同步更新·.gitignore 已正确收 .env（未曾进库）

---

## §2 WELD QUEUE（零迁移焊敏感·ready）

- [x] G-d-partial · AA4余面add-constraint·actor.ts内部record面+null-proto存储层（schema superRefine·零迁移·不改schemaKeys） · 焊敏感=schema(actor.ts superRefine add-constraint) · 完结 commit=67f1cdd · test=3011(+54)

---

## §3 BLOCKED（consumer-blocked / 依赖未满 / 需拍板）

### Phase F（指纹红线批）

- [x] F-a（生产者侧）· content_hash自填充+热加载+AA6 fire · 完结于P7-5c·effectGate.ts（fillEffectPackHash/isEffectPackHashStale/computeEffectPackSetHash）
- [ ] F-a（挂载侧）· RootSchema挂载（嵌mod注册表·拍板④已决·schemaKeys=52不变） · 解锁=P0-7梯队6 effect生产者+caller接线
- [x] F-b · side_effects注册集进指纹(18th BUNDLE_MEMBER)+AA6断言 · 完结于P7-5c·fingerprintManifest.ts+rng.ts additive扩
- [x] F-c · U3指纹版本分段（与M6共用分段机·碰fingerprint） · 层1 commit=3322071 · 层2 commit=657fa1a · test=3044(+19)
  - 层1(3322071·t3016): 引擎版本/Schema版本进PRESET_FIELDS(7→9)+rng.ts optional签名+property test(pre-wired)
  - 层2(657fa1a·t3044): engine/segment.ts 新建(纯函数·hashCanonical·rng.ts只读调用)
    - computeSegmentHeadHash(引擎版本?,Schema版本?,难度系数组指纹?,前段哈希)
    - openSegment: 新段 append·段序号连续·genesis前段哈希=''·exactOptionalPropertyTypes 兼容
    - verifySegmentChain: 逐段核对前段哈希·断链→{valid:false,brokenAt,message}·调用方拒载+显式警示(D4)
    - shouldOpenNewSegment: 任意维度变→true(genesis/引擎版本/Schema版本/难度系数组指纹·M6·C5)
  - schema/dollar.ts: 存档头Schema 新增 版本段记录? optional array(additive-only·零迁移·观测史只搬运)
  - fingerprint.property.test.ts: AA6 Gate-S 19条(S1确定性/S2成员变→指纹变5维度/S3链校验6种/S4触发条件6种)
  - 指纹=118(+19·C梯队按设计变动)·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空·schemaKeys=52

### Phase G（registry populate 路径II）✅ 梯队A/B/C/D 全完结

- [x] G-b · path II populate registry · commit=3f2d145 · 已移 §1
- [x] G-c · S2仲裁ログ + C2母题写入口fire · commit=fd05c05 · 已移 §1
- [x] G-d-registry · 可写键叶段成员资格 · commit=706cd9b · 已移 §1
- [x] G-e · S5规则引用完整性扫描 · commit=fd05c05 · 已移 §1
- [x] D-2 · 散落别名归一 · commit=d2e1646 · 已移 §1（D-3 ✅ 074b736）

### Phase H（签名+外链+子域·全defer）

- [ ] H-a · 6.74验签+DP验签放行+原生卡包通道⑮ · 解锁=crypto路径三选一拍板（park不强决）
- [ ] H-b · 外链三态本地化快照器 · 解锁=hosts/tavern P1
- [ ] H-c-1 · 导出剥离fire（securityBoundary.ts 4敏感键·常量已锁） · 解锁=hosts/导出管线（P0-9/P0-11）
- [ ] H-c-2 · CSP+sandbox iframe · 解锁=hosts/tavern P1
- [x] H-c-3 · 主权降级「需确认」fire · 完结于P7-5e·sovereigntyFloor.ts（checkSovereigntyFloor/autoFloorAuthorization·5件地板事件·凌驾抢话档门）
- [x] H-c-4 · effect deltas过五道闸clamp · 完结于P7-5c·effectGate.ts（runEffectGates·③前缀·②白名单·④钳制·⑤原子令牌）

### Phase I-b（盐·consumer-blocked）

- [ ] I-b-G6 · G6小剧场盐隔离 · 解锁=P0-5 G6 consumer（rng.ts已授权·仅剩consumer锁）
- [ ] I-b-盐3 · 出厂离场契约进指纹+补结RNG第三盐 · 解锁=P2 offstageSettler（rng.ts已授权·仅剩consumer锁）

### B6残留

- [ ] B6-I · S3写卡口接存档口（RootState层·fail-open·defense-in-depth） · 解锁=P0-9存档层 ∧ hosts/ALERT评估
- [x] S6 · 受治理键空间enumerate populate+S6实装铁律（未注册串=降级非拒收） · commit=3f2d145 · 已移 §1
- [x] V3展开器(runtime) · 完结于P7-5b·verbExpand.ts（expandVerbTarget Unicode码点序·applyVerbToTargets）
- [x] G7 · 死亡拦截器引擎级硬顶 · 完结于P7-5a·deathIntercept.ts（scanDeathIntercept 首命中即停）
- [x] effect-过闸 · effect包deltas过五道闸 · 完结于P7-5c·effectGate.ts（runEffectGates）

### Phase L（deferred items）

- [x] L-13 · 记忆recency并入P0-3统一衰减累积器（0.995指数因子·L-1/L-6已✅） · commit=bea1ae9 · test=3025(+9)
  - engine/time.ts: decayStep(value,ratePerMinute,spanMin,recencyRate?) — 线性衰减+fixedPow recency·单一实现·禁第二实现
  - engine/tick.ts Phase 7: 印象/意象内联 Math.max→decayStep·新增记忆(工作记忆+长期归档).权重 recency decay(MEMORY_RECENCY_RATE=0.995)
  - time.test.ts: 9条 fixture(零速率/线性/下界/recency-only/组合/floor后recency/口径三处同输入恒等/确定性)
  - 指纹=118·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空
- [x] L-14 · 历法权威表+时代错置校验数据源 · commit=8f35f04 · test=3025(±0)
  - schema/lore.ts: lore条目Schema 新增 时代名?/时代范围?{开始年,结束年?}/可用物品类别?/可用制度类别? (additive-only·零迁移)
  - 消费分工：结构可判→P0-6钳制闸 / 语义判→P0-8(L-28)；时间换算唯一源铁律注释：时代错置校验必须查时间核不自算
  - 表本体借 lore谓词集合路径进指纹(触发谓词_冻结后聚合·R7-b gate判定路径)
  - 指纹=118·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空
- [ ] L-16 · 叙事校验闸/二审/自反思走指令组边界接线 · 解锁=P0-8叙事校验闸
- [ ] L-17 · 效果4类+房间不可挂属性白名单（L-9已✅） · 解锁=L-9 effect executor接线（P0-4/P0-7）
- [ ] L-18 · 纠偏重写=模态内步骤·不新增模态栈深度 · 解锁=P0-8
- [ ] L-19 · 任务显式状态机（START→SEARCHING→RETURNING→COMPLETE） · 解锁=L-9 effect executor ∧ P0-4任务schema（还卡L-9接线+P0-4·stateMachine.ts已完整实装）
- [ ] L-20 · 校验闸/因果校验器LLM调用独立盐隔离（rng.ts已授权·仅剩consumer） · 解锁=P0-5 G6盐 consumer
- [x] L-21 · LLM重要度分创建即冻结+进指纹+永不重算 · 完结于P7-5d·importanceFreeze.ts（freezeImportanceScore/assertImportanceFrozen·冻结纪律·进指纹 via content_hash→聚合哈希链路）
- [ ] L-24-结构 · 归一化准入闸·确定性自动修复（补缺字段/非法prefab/越界坐标） · 解锁=P0-8
- [ ] L-26 · 校验失败闭环·有界重试≤3 · 解锁=P0-8
- [ ] L-27 · 前置条件代码化（位置/库存/属性三类·L-9已✅） · 解锁=L-9 effect executor接线（P0-4/P0-7）
- [ ] L-28-枚举 · Cheating枚举并入钳制闸/动词白名单 · 解锁=P0-8校验闸consumer
- [ ] L-29 · 两模式按子系统指派（Graph-First/Post-Generation-Validation） · 解锁=P0-8
- [ ] L-30-算法 · 动态新动作可达性回归校验 · 解锁=P0-10

### Phase K/B7（gated by P0-7）

- [x] K-a（Q批+V3写入口侧）· 完结于P7-5f·covenantWrite.ts（Q1/Q2/Q4/Q6 + verbWriteToTargets）
- [x] K-a（V3谓词求值侧）· 完结于DSL parser实装·expandVerbTarget DSL谓词筛选+evalPredStr lore触发谓词·commit=ee67ef5

### 后续阶段（P0-7+）

- [ ] P0-7-remainder · Z3/Z5/J1/级联轮/模态并发/V1/AA1主接线等结算子项 · 解锁=P0-7-start落地
- [x] P0-8 Batch 1 · 组装器骨架 + 纵切止血（调用类型注册表 + 近K历史 + lore谓词切片 + NPC记忆/情绪 + 知情过滤前置闸 + live账本 + 编年史 + POV认知投影） · commit=2fff133 · test=3152(+33)
  - packages/core/prompt/callRegistry.ts（新）: CALL_TYPE_REGISTRY 五种具名类型·DEFAULT_NEAR_K=6·CallTypeSpec含切片预算·零裸prompt串
  - hosts/slice/assemble.ts（升级）: povEntityKey前置闸·nearK历史·narrativeHistory·actionHistory·balances·lorePredCtx·NPC记忆/情绪·编年史·POV认知投影·backward-compat
  - hosts/slice/server.ts（接线）: narrativeWithFilter切到新assembler API·近K历史扩至DEFAULT_NEAR_K·povEntityKey gate内移
  - packages/core/package.json: 补 ./prompt/callRegistry export
  - hosts/slice/tests/m_p8tier1.test.ts（新·33 tests）: ①注册表完整·②近K历史·③动作序列·④lore谓词切片R7-b·⑤NPC记忆·⑥情绪栈·⑦编年史·⑧知情过滤前置闸·⑨live账本·⑩切片不进指纹·⑪双机一致性·⑫POV认知投影
  - 验收：schemaKeys=52·指纹=84/20不变·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空·test 3119→3152(+33全绿)
- [x] P0-8 Batch 2 · 校验闸族（P–R–B信念派生+PANGeA叙事校验+WhatELSE动机校验+物理隔离出口） · commit=25dd422 · test=3190(+38)
  - packages/core/engine/beliefDerive.ts（新）: P–R–B三元派生·R7-b双轨(gate→进指纹/narrative→不进指纹)·纯函数确定性
  - packages/core/engine/narrativeValidator.ts（新）: PANGeA越权知情/凭空物品/在场矛盾/时序错乱·单次纠偏重试·失败软拒·玩家主权铁律·DEFAULT_RETRY_MODE=single_retry_soft_reject
  - packages/core/engine/motivationValidator.ts（新）: WhatELSE情绪矛盾/记忆违背/信念动机缺失·依赖①信念态·物理隔离输出
  - hosts/slice/engine/validationGate.ts（新）: 统一校验出口·内层见全局真值·外层outputFilteredSecrets POV过滤·禁后门·deriveBeliefFromState便捷函数
  - packages/core/package.json: 补3条exports(beliefDerive/narrativeValidator/motivationValidator)
  - hosts/slice/tests/m_p8tier2.test.ts（新·38 tests）: ①信念派生P–R–B·②PANGeA校验·③玩家主权·④WhatELSE动机·⑤见真相输出过滤物理隔离
  - 验收：schemaKeys=52·指纹=84/20不变·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空·test 3152→3190(+38全绿)
- [x] P0-8 Batch 3 · 对账闸族+切片预算B1-B6+N-4输出软拒 · commit=d81eee7 · test=3233(+43)
  - packages/core/engine/sliceBudget.ts（新）: estimateTokens/estimateSliceTokens/applySliceBudget·B1-B6降级顺序铁律(lore→nearK→chronicle)·组装侧·不进指纹
  - hosts/slice/engine/reconcileGate.ts（新）: runReconcileGate·M2.5/M2.6/M2.7三层统一出口·分级失败(可解析歧义→单次重试/语义拦截→即时硬拒)·重Roll常驻提示
  - hosts/slice/engine/outputGuard.ts（新）: N-4输出侧·runOutputGuard复用detectSoftReject·玩家主权铁律(不自动重生/不抬预算)·常驻图标提示·不弹窗
  - hosts/slice/assemble.ts（升级）: 集成切片预算·callTypeKey路径触发B1-B6降级·向后兼容(无callTypeKey不降级)
  - packages/core/package.json: 补2条exports(sliceBudget/softReject)
  - hosts/slice/tests/m_p8tier3.test.ts（新·43 tests）: ①解析器单一真相源·②对账闸分级失败·③指纹边界断言·④切片预算B1-B6降级顺序·⑤N-4玩家主权断言
  - 验收：schemaKeys=52·指纹=84/20不变·REPLAY-01=24·C2=17·黄金向量逐位恒等·红线diff空·test 3190→3233(+43全绿)
- [x] P0-8 Batch 4 · AOHP option_id+菜单生成前知情过滤+反人格标签指令+NSFW调试预留 · commit=aebd117 · test=3283(+50)
  - packages/core/engine/aohp.ts（新）: buildOptionId/buildMenuOptionIds/sortedOptionIds·语义键verb:target:canonicalArgs·同义归一·碰撞消歧(#fnv1a32_8hex)·零误撞断言·不含序号·只读复用hashCanonical
  - hosts/slice/engine/menuFilter.ts（新）: filterMenuCandidates·越权选项不生成(非隐藏)·复用filterSecretsForPOV·MENU_FILTER_ROLL_HINT走软拒通道·玩家主权
  - packages/core/engine/fingerprintManifest.ts（改）: PRESET_FIELDS +1 'AOHP選項id集'（进指纹·additive-only）→ 总条目 83→84（BUNDLE20/PRESET10/SNAP5/EXCL49）
  - packages/core/engine/rng.ts（改）: hashPresetFingerprint签名 +AOHP選項id集?:string[]（additive-only·函数体零改）
  - hosts/slice/assemble.ts（改）: callTypeKey补入destructuring(修预存stale.js bug)+Anti-Labeling Directive静态模板+NPC行OCEAN注入(O/C/E/A/N·默认50)
  - hosts/web-debug/index.ts（改）: isDebugNsfwOverrideActive预留接口（window.__DEBUG_NSFW||nsfw=1·仅web-debug宿主·不影响正式打包）NSFW Ring0 defer P1
  - packages/core/package.json: +1 export(engine/aohp)
  - packages/core/tests/fingerprint.property.test.ts: 新增AOHP选项进指纹断言3条(存在改变指纹·不同值改变·预排序恒等)
  - packages/core/tests/runProposalGate.test.ts: manifest总数 83→84
  - hosts/slice/tests/m_p8tier4.test.ts（新·47 tests）: ①语义键结构+同义归一+碰撞消歧+零误撞 ②稳定性+进指纹边界(顺序无关) ③菜单知情过滤(越权不生成+rollHint) ④Anti-Labeling+OCEAN+lint断言 ⑤NSFW defer P1确认
  - 验收：schemaKeys=52·指纹=84(BUNDLE20/PRESET10/SNAP5/EXCL49)·REPLAY-01=24·C2=17·黄金向量逐位恒等·red线diff空(gate/conservation/computeDelta/rng函数体零改)·test 3233→3283(+50全绿·64 files)
- [x] 纵切 Demo 薄壳 · P0-11 前哨 · web-debug 单宿主端到端 · commit=da45886 · test=3342(+59)
  - D0: world.ts TS2345 已清（M-a 批·RootSchema.parse 填满默认值）·schemaKeys=52·tsc 28（baseline）
  - D0: reconcileGate.ts TS2459 修复（TickProposal 改从 proposalSchema.js 导入·-1 error·无函数体改动）
  - D1: hosts/web-debug/demo.ts（新·CLI 端到端演示·无LLM·脚本化叙事·D1-D4全覆盖）
  - D1: assemblePrompt 输出结构·systemPrompt/userPrompt·含NPC姓名/地点/OCEAN注入/Anti-Labeling Directive
  - D1 prompt-dump: 近K历史注入·live账本注入·lore谓词切片（命中/不命中）·多拍历史跨拍累积
  - D2: AOHP菜单 buildMenuOptionIds·option_id语义键·同义归一（五文/5文→5文）·碰撞消歧·sortedOptionIds顺序无关·零误撞断言
  - D2: runReconcileGate 分级失败·covered/hard_rejected(债权)/retried_covered/retried_failed·rollHint常驻图标
  - D3: POV切换·filterSecretsForPOV(PC=0秘密/NPC_WANG=S1)·assemblePrompt secretSection生成前过滤·$谜底零泄漏
  - D3: filterMenuCandidates·secretRef越权→denied(生成前过滤·非隐藏)·NPC_WANG POV→permitted·rollHint
  - D3: Anti-Labeling Directive存在·OCEAN O50/C50/E50/A50/N50注入NPC行·禁止性格标签·禁止输出数值
  - D3: NSFW物理隔离·Node环境'window' not in globalThis·demo代码不进指纹(manifest=84)·slice不re-export
  - D4: hosts/slice/engine/archive.ts additive: FullArchiveHeader(RULE_VERSION=3/中文数字解析规则版2/软拒规则版1/AOHP语义键版1/schemaKeys52)+createFullArchiveHeader+migrateToFullArchiveHeader
  - D4: JSON往返恒等·migration幂等·seed/计数器守恒·旧MinArchiveHeader→FullArchiveHeader补全
  - D4 P0-9侦察: 旧存档缺RULE_VERSION/中文数字解析规则版/AOHP语义键版(已记录·本demo不实装迁移)
  - 验收: schemaKeys=52·指纹manifest=84·黄金向量5c1d0233/63b3e729/db10d5c7逐位恒等·red线diff空·tsc28·test3342(65files)
  - 不验: 双机恒等（留P0-11）·P0-9存档迁移实装（仅侦察记录）
  - hosts/slice/tests/m_webdemo.test.ts（新·59 tests）: D0×4 / D1×13 / D2×12 / D3×13 / D4×12 / NSFW×4 / 反人格标签×5
- [ ] P0-9 · 存档层G2原子性/U1迁移单元/U3版本分段 · 解锁=P0-7基础
- [ ] P0-10 · 回归测试体系+DoD复验 · 解锁=P0-8+P0-9
- [ ] P0-11 · 双宿主薄壳 · 解锁=P0-10
- [ ] P1 · 酒馆宿主+全生命周期demo+导入器 · 解锁=P0-11
- [ ] P2 · offstageSettler+RAG+多人+第三盐+离场演化 · 解锁=P1

### bugs1/bugs2 依赖链登记（P0-1~P0-8·带依赖未勾·2026-06-21）

> 来源=docs/spec/bugs1.md(Part1)·bugs2.md(Part2)；仅 `[ ]`+`❓-` 项·P0-1~P0-8 范围；已在本文其他区段（Phase F/G/H/I-b/B6残留/Phase L/K/B7）的编号不重复登记。

#### BL-1 依赖 P0-8 叙事校验闸/二审/组装器（Phase L 中 L-16/L-18/L-24-结构/L-26/L-28-枚举/L-29 已登记·不重复）

- [ ] 🟠 M1·6.50 NPC心声输出端∩窗知情过滤消费端接线 ❓-P0-8叙事组装·知情过滤消费端未接线
- [ ] 🟠 知情分治切片组装两窗分野（已写蓝图） ❓-P0-8组装器消费端
- [ ] 🟠 Z1对账闸详规（提案单Zod schema+记账动词逐槽机械diff） ❓-P0-8对账闸规格·未实装
- [ ] 🟠 Z2方向敏感槽枚举（转账/缔约/关系/主被动/秘密五类必填槽） ❓-P0-8对账闸·未实装
- [ ] 🟠 宏-A·evaluateMacros固定三段求值序（组装器确定性前提） ❓-P0-8组装器接线
- [ ] 🟠 M4·6.50 元指令判别默认拒向（解析失败降级纯RP零落账） ❓-P0-8叙事组装·未接线
- [ ] 🟠 自定义输入旁路强制离场·在场名单/实体生命周期（M4手玩发现） ❓-P0-8叙事通道纯只读于在场名单∧生命周期·规格待入P0-8注册表白名单
- [ ] 🟠 E1/E3·6.55 翻看媒介读取落账管线（covert检定→先落账后呈现）+失真传闻分流 ❓-P0-8组装器消费端·媒介读取落账未实装
- [ ] 🟠 C5·6.53 跨席位读屏防护（per-seat投影快照·$层物理不出进程） ❓-P0-8规格·per-seat投影未实装
- [ ] 🟠 6.76续·G5/G9/M1/M2/M6/M7/M9/P7/P8/O2/O3/O5/IM1/PF2等二审/视角/小剧场硬化 ❓-P0-8组装器·6.76续硬化批未实装
- [ ] 🟠 AOHP候选动作菜单预约束·TinyWorld（ActionOption后端拥有tool·模型只选option_id） ❓-P0-8组装器·菜单预约束未实装
- [ ] 🟠 DP·组装器旁路注入（explicit/community档优先取云端缓存策略） ❓-P0-8组装器·云端策略旁路注入未实装
- [ ] 🟠 🎬NSFW四档·场景检测器 预切后仍失败在已切NSFW模型重roll二次安全网 ❓-P0-8叙事管线·场景检测器二次安全网未接线
- [ ] 🟠 🤖破限引擎化·引子自动选择（组装器按模型族自动挑破限引子） ❓-P0-8组装器·引子自动选择未实装
- [ ] 🟠 酒馆·RAG召回过滤（RAG召回只喂叙事侧·过知情过滤按宿主认知投影） ❓-P0-8组装器·RAG知情过滤未接线
- [ ] 🔴 🎬NSFW四档·切模型玻璃箱（本回合切模型须明示「因X切到模型Y」·未配key禁用UI） ❓-P0-8叙事管线·Ring0接线玻璃箱文案+UI禁用开关未实装
- [ ] 🟡 规划自顶向下递归分解+中断后从反应点重规划 ❓-论文新增·日程递归分解/中断重规划·依赖P0-8规划层·未实装
- [ ] 🟡 Z4散文残跳口径三件兜底（让位序已入6.64） ❓-P0-8组装器·未登记
- [ ] 🟡 B1–B6·6.64 组装器三拍板（确定性律/四级供给阶梯/双闸正交） ❓-P0-8组装器规格·未落
- [ ] 🟡 N1·6.51 跨周目记忆摘要有界性（禁链式拼接） ❓-P0-8组装器·N1有界性未实装
- [ ] 🟡 E2/E6·6.55 重生成读发布时刻frozen快照+书信双宿主 ❓-P0-8组装器消费端
- [ ] 🟡 6.67 注册表重试策略降出厂值+玩家覆盖层重试策略 ❓-P0-8注册表·未实装
- [ ] 🟡 AA9/第三批·3-12 L2蒸馏失败机械兜底（按重要度截断·零LLM） ❓-P0-8组装器·N1同点
- [ ] 🟡 增审1·已拍板 采纳=显式固化标记（废6.43最高序号=采纳）+X7 ❓-P0-8组装器·规格口径未实装
- [ ] 🟡 Y8/Y11/Y12 整流原子性/世界书预算闸/世界书注入面安检清单 ❓-P0-8组装器消费端
- [ ] 🟡 三十·卡格式·已拍板 开场白/序章具名调用输入槽+三十之二增补 ❓-P0-8调用类型注册表
- [ ] 🟡 弱模型多级回退+防注入净化·TinyWorld（结构化解析三套正则+中文数字） ❓-P0-8组装器·弱模型回退未实装
- [ ] 🟡 派生草稿层+记忆认知隔离·TinyWorld/Luker（NarrationDraft/DiaryDraft默认值+多键归一） ❓-P0-8组装器·派生草稿层未实装
- [ ] 🟡 NPC跨拍记忆/情绪连续性缺口（根因①②·治本归模块6认知档案/P0-7认知结算） ❓-P0-8Batch1已注入现有字段·持久记忆回写待模块6
- [ ] 🟡 prompt转换矩阵·Luker（一IR→多provider shape·PROMPT_PROCESSING_TYPE） ❓-P0-8组装器·转换矩阵未实装
- [ ] 🟡 姓名知识=render-time投影（over实体键·不baked进frozen prose） ❓-P0-8组装器·姓名知识投影未实装
- [ ] 🟡 中文数字解析版本化·对撞⑦（CHINESE_NUMBER_RULE_VERSION=2已进指纹·弱模型路径未接） ❓-P0-8组装器·版本化未实装
- [ ] 🟡 "deny all"兜底·图谱外/规则外查询拒答或升级 ❓-P0-8校验闸·兜底路径未实装
- [ ] 🟡 越界分类法运用(PANGeA #2)·校验闸引用P0-1枚举·时代错置 ❓-P0-8校验闸·分类法运用未实装
- [ ] 🟡 校验闸面向本地小模型设计(PANGeA #4) ❓-P0-8校验闸·小模型目标未实装
- [ ] 🟡 6.69·渲染模式三分·P0-8单列（调用类型注册表条目渲染模式?行为三分） ❓-P0-8注册表·渲染模式行为未实装
- [ ] 🟡 🎚️玩家主权覆盖注入点（叙事专属·专家模式·组装器仅叙事调用且专家模式开时替换SystemPrompt） ❓-P0-8组装器·覆盖注入点未实装
- [ ] 🟡 🎚️玩家主权覆盖回退链（覆盖致乱码/拒答仍走既有降级回退） ❓-P0-8组装器·覆盖回退链未实装
- [ ] 🟡 🎬NSFW四档·解禁词玻璃箱（explicit引擎解禁词对玩家可见·community可编辑） ❓-P0-8组装器·解禁词玻璃箱未实装
- [ ] 🟡 🎬NSFW四档·分档注入（叙事专属·按内容分级选叙事提示词强度） ❓-P0-8组装器·分档注入未实装
- [ ] 🟡 🎬NSFW四档·正交性（NSFW降级模型开关⊥内容分级） ❓-P0-8组装器·正交性规格未实装
- [ ] 🟡 🤖破限引擎化·预填注入点（叙事专属·assistant预填拼接） ❓-P0-8组装器·预填注入点未实装
- [ ] 🟡 酒馆·结构化输出adapter按provider择优 ❓-P0-8适配层·结构化输出未实装
- [ ] 🟡 酒馆·朗读范围过滤走结构化输出已知段 ❓-P0-8组装器·朗读范围确定性过滤未实装
- [ ] 🟡 酒馆·前缀缓存（上下文前缀稳定性优化·吃满后端KV） ❓-P0-8组装器·前缀缓存未实装
- [ ] 🟡 命名实体音译漂移·RAG侧（RAG分块挂实体键metadata·召回=实体键过滤+向量） ❓-P0-8组装器RAG侧·实体键过滤未实装
- [ ] 🟡 NSFW含蓄降级档（降级时备含蓄淡出过渡档fade-to-black） ❓-P0-8组装器·含蓄降级档未实装
- [ ] 🔴 lore谓词切片·RAG召回（条目多则走中文embedding+按字符分块·RAG未接） ❓-P0-8 Batch1已接lore谓词ctx·RAG召回路径未接
- [ ] 🔴 lore两层·表层编年史L2蒸馏+切片预算6.64（Batch1已接近K/编年史/POV·L2蒸馏未接·Batch3后续） ❓-P0-8 Batch3后续·表层编年史L2蒸馏未接
- [ ] 🟢 self-reflection自反思（PANGeA #3） ❓-P0-8校验闸内部机制·未实装
- [ ] 🟢 Plot Reviewer角色动机模拟（WhatELSE #4） ❓-P0-8因果校验器·未实装
- [ ] 🟢 防注入净化边界·对撞⑦（仅碰结构化协议头·不碰自由正文） ❓-P0-8组装器净化边界
- [ ] 🟢 E5·6.55 两窗分野明文（元层窄窗∩/世界内宽窗+落账） ❓-P0-8组装器规格·未实装
- [ ] 🟢 Y9/Y10 渲染缓存先过机械校验后写/已结算未呈现扫描/选项激活点 ❓-P0-8组装器消费端
- [ ] 🟢 越界"Cheating"结构化部分并入钳制闸/动词白名单（PANGeA） ❓-论文新增(PANGeA)·结构化部分待入钳制闸

#### BL-2 依赖 P0-9 存档/全局回滚计数器

- [ ] 🟡 每拍盐值登记进 tick_log（谢幕前拦截扫描步G7已接） ❓-P0-7结算·每拍盐值登记tick_log依赖P0-9全局回滚计数器·未完
- [ ] 🟠 🎬NSFW四档·模型路由×确定性（本拍实际路由模型随档快照·routedVia写入tick_log） ❓-P0-8叙事管线·routedVia写入tick_log待Ring0接线

#### BL-3 依赖 P0-10 回归台（Phase L L-30-算法已登记·不重复）

- [ ] 🟡 信息扩散（1→8/1→13人）涟漪复现·验证项（涟漪引擎已落P7-2·此为回归台验证） ❓-论文新增·涟漪复现对照·依赖P0-10回归台
- [ ] 🟡 级联轮「每轮全量重扫」vs脏标记优化前后双跑等价断言 ❓-已写入蓝图·优化等价断言依赖P0-10回归台

#### BL-4 依赖 P0-11 双宿主 adapter

- [ ] 🔴 P0-2 U6宿主侧外置状态（spec@P0-2·impl/test@P0-11） ❓-spec@P0-2·impl/test依赖P0-11双宿主adapter
- [ ] 🔴 Prompt injection hosts/运行时输入路由（架构隔离复核✅·运行时路由部分未实装） ❓-defer P0-11双宿主
- [ ] 🟡 模型名归一镜像·Luker（normalizeTokenizerModel与server getTokenizerModel配对·双写点防漂移） ❓-P0-7·model id归一双份镜像不变量未实装·依赖P0-11双宿主adapter

#### BL-5 依赖 P1/P2

- [ ] 🟡 BASELINE·存档clamp SFW/light包加载越界档存档→migrate期clamp降级 ❓-依赖baseline实切·未上线
- [ ] 🟡 BASELINE·导入闸 SFW/light包导入explicit/community覆盖串或破限引子→拒收 ❓-依赖baseline·导入闸未实装
- [ ] 🟢 BASELINE·确定性确认 内容分级已在FINGERPRINT_EXCLUDED_FIELDS·跨baseline指纹恒等 ❓-依赖baseline·确认待落

#### BL-6 论文新增·未实装

- [ ] 🔴【H篇】内部信念写成逻辑可推理格式·ASP/Clingo校验 ❓-论文新增·校验层未实装
- [ ] 🔴【H篇】校验失败闭环·二分搜索定位最小矛盾子集·有界重试≤3 ❓-论文新增·有界重试闭环未实装
- [ ] 🔴【L篇+One Life篇】动作/转移标准结构=前置条件(precondition)+效果(effect)四类 ❓-论文新增·动词结构未实装
- [ ] 🔴【G篇】确定性归一化层不可省（消融实验→校验通过率归0） ❓-论文新增·确定性修复闸未实装
- [ ] 🔴【F篇】"not hallucinated"是结构有效偷换事实正确（grounding度量） ❓-论文新增·grounding度量未实装
- [ ] 🔴【F篇】坐标哈希→seed→固定LLM采样（重访同一地点产出相同内容） ❓-论文新增·坐标哈希派生未实装
- [ ] 🔴【F篇】模型升级打碎确定性哈希·锁定LLM版本约束 ❓-论文新增·约束待写P0-9
- [ ] 🔴【L篇】动态新动作不保证可通关性·需可达性/可完成性回归校验 ❓-论文新增·可达性回归未实装（依赖P0-10）
- [ ] 🔴【J篇】纯prompt约束满足率~38%·硬约束解码100%满足但延迟15-25× ❓-论文新增·decoder强制未实装
- [ ] 🔴【I篇】分层记忆(主上下文=内存/外部=磁盘)+确定性换页+内存压力警告 ❓-论文新增·分层记忆未实装
- [ ] 🟠 P0-5 G6小剧场盐隔离·consumer锁（注：I-b-G6在Phase I-b·此为论文维度） ❓-P0-5 RNG·盐隔离仅剩consumer锁
- [ ] 🟡【G篇】任务=显式状态机(START→SEARCHING→RETURNING→COMPLETE)+可达性（Phase L L-19论文维度加强） ❓-论文新增·任务状态机未实装
- [ ] 🟡【L篇】效果只分4类(移动/设属性/建对象/删对象)+房间不可挂属性白名单（Phase L L-17论文维度加强） ❓-论文新增·效果白名单未实装
- [ ] 🟡【One Life篇】律只在相关时才激活形成专属计算图 ❓-论文新增·律激活图未实装
- [ ] 🟡 Γ六类约束要进schema（唯一性∃!/变量类型/对立/复现/资格/目标母题） ❓-论文新增·约束schema未落
- [ ] 🟡【J篇】当前约束方法只能处理词法约束·语义约束仍开放难题 ❓-论文新增·语义约束待H篇
- [ ] 🟡【L篇】前置条件可直接翻译成代码检查（位置/库存/属性三类闸模板） ❓-论文新增·闸代码模板未实装
- [ ] 🟡【I篇】淘汰前先把要点写回working context（摘要固化）再丢原文 ❓-论文新增·摘要固化未实装
- [ ] 🟡【H篇】共享记忆(协调用)vs私有记忆(内部推理用)严格分离 ❓-论文新增·记忆分离未实装
- [ ] 🟡【M篇】导演层统一调度·演员只演·场景延续做成显式判定函数 ❓-论文新增·导演层未实装
- [ ] 🟡【K篇】沉浸感(Immersion)vs能动性(Agency)正交目标显式权衡 ❓-论文新增·权衡文档未实装
- [ ] 🟡【One Life篇】概率律混合确定性建模随机结果（丧尸下一步概率分布） ❓-论文新增·概率律范式未实装
- [ ] 🟡 校验闸/因果校验器若调LLM独立盐隔离（PANGeA+WhatELSE·Phase L L-20论文维度） ❓-论文新增·校验盐隔离未实装
- [ ] 🟡 向量/嵌入相关性召回非确定性隔离在叙事层 ❓-论文新增·召回隔离未实装
- [ ] 🟡 叙事语义校验闸/二审/自反思走指令组边界（PANGeA#1#3+WhatELSE#2·Phase L L-16论文维度） ❓-论文新增·校验组边界未实装
- [ ] 🔴 P0-5 F篇 信念派生取材集进指纹枚举表（P–R–B+AA6先例·取材变→指纹变断言） ❓-依赖P–R–B派生(Batch2已接)·指纹枚举未落
- [ ] 🟢 quest motif保证任务树分支共享连贯目标 ❓-论文新增·未实装
- [ ] 🟢 人格5轴设为"不可漂移锚"防NPC人设被对话侵蚀 ❓-论文新增·人设漂移防护未实装
- [ ] 🟢 校验失败纠偏重写=模态内步骤·不新增模态栈深度（Phase L L-18论文维度） ❓-论文新增·纠偏步未实装
- [ ] 🟢【M篇】按玩家发言生成"表演指导"（情绪/肢体/语气）作为可选切片 ❓-论文新增·未实装

#### BL-7 依赖他条 schema 拍板 / P0-6·P0-7未完 / 文档同步

*(文档同步 umbrella — 与各批并行)*
- [ ] 🔴 第三批落地·3-1 全仓grep「拍号 vs 时刻」术语替换 ❓-文档同步·全仓grep未跨仓跑
- [ ] 🟠 全部已拍板口径同步进修订决议与docs/spec ❓-文档同步·各批拍板口径回写决议/docs持续未清
- [ ] 🟡 A1·六·三十二 剩docs/spec同步（蓝图已新口径·盐口径） ❓-文档同步·docs/spec未同步
- [ ] 🟡 增审3/6·已拍板 6.69/元层旋钮/6.43回写 ❓-文档同步·6.69/元层旋钮/6.43回写未落
- [ ] 🟢 G8回想截断/观测史/两窗分野/串治理键空间/结构洞/manifest规格补全/律X·律Y入决议 ❓-文档·律/口径入决议未落
- [ ] 🟢 C1/D1/D2/E1 D1弃用清单补节+E1半句 ❓-文档·D1弃用清单/E1半句补节未落
- [ ] 🟢 三十·卡格式·已拍板 可分发卡三句口径写进docs/spec+决议 ❓-文档同步·可分发卡三句口径未落
- [ ] 🟢 AA13·五 纪元轴世界域归属明文6.36/6.62 ❓-文档·纪元轴世界域归属明文未落
- [ ] 🟢 三悬案/AA1–AA13 文档 口径同步进决议与docs/spec ❓-文档同步·三悬案/AA口径入决议未落
- [ ] 🟢 第三批落地·2-3 顶部目录已同步6.73·收尾确认未勾 ❓-文档·收尾确认未勾
- [ ] 🟢 第三批落地·3-14 模块14自愿换角措辞（已对·并入2-2）收尾未勾 ❓-文档·收尾未勾
- [ ] 🟢 律明文写入决议（律甲/乙/丙/丁/戊/己/庚/辛·律庚/辛口径入决议重点） ❓-文档同步·律口径未入册

*(P0-1 誊写/schema)*
- [ ] 🔴 反向核查·G-1·誊写未完 4.2世界域累计活跃区间表·C3双时钟/4.x总表誊写（代码已落·仅文档） ❓-代码已落·4.x总表誊写未完
- [ ] 🟡 第三批落地·3-6 知情分治W1 schema注释（知情类append-only/印象类可衰减·已写蓝图） ❓-已写入蓝图·schema注释未落
- [ ] 🟡 三十二·A2·彩蛋池装配器直写 记忆种子三件拆两通道·$隐藏记忆库走装配器直写 ❓-装配器规格·实装未落

*(P0-6 未完·依赖他条 schema/闸拍板)*
- [ ] 🔴 世界信息·lore谓词冻结（导入闸·lore条目触发谓词过DSL文法冻结+受治理键归一） ❓-P0-6 lore导入闸·未实装
- [ ] 🔴 世界信息·受控接口能力集（mod作者声明式受控接口能力集对标narrative-agent [TOOL]） ❓-P0-6·受控接口能力集未实装
- [ ] 🔴 世界信息·设定/状态分界（lore知识库只装世界恒真知识·导入闸作者警示·同Y13） ❓-P0-6 lore导入闸·作者警示未实装
- [ ] 🟠 Y13 世界书设定/状态分界硬化（实体现状与秘密禁入世界书·含实体名+状态断言作者警示） ❓-P0-6导入闸·Y13分界未硬化
- [ ] 🟠 声明式effect包低门槛档（intervention_pack过五道闸+clamp fire B6·降mod作者门槛） ❓-P0-6·过五道闸+clamp fire B6
- [ ] 🟠 社区预设模块分类器（叙事皮肤vs真值绑定·按稳定键导入·冲突不静默覆盖） ❓-P0-6·预设模块分类器未实装
- [ ] 🟠 P0-6·6.76续硬化批 IM1审稿注入面+IM3文风键受治理+IM5重写权限 ❓-P0-6硬化批·IM注入面未实装
- [ ] 🟠 酒馆·内容分级闸（硬审查模型打不穿prompt·NSFW模型回退确认） ❓-P0-6酒馆导入闸·未实装
- [ ] 🟠 专家模式风险门（手动勾选+强制阅读风险提示才解锁覆盖·默认关） ❓-P0-6专家模式门·未实装
- [ ] 🟡 Z导入闸 缺数值/方向槽→作者警示（警示族打包行未含Z） ❓-P0-6导入闸·警示族未含Z
- [ ] 🟡 effect包过闸制·对撞④（effect包deltas过五道闸+受规则补丁clamp/lock约束·非intervention_pack路径） ❓-P0-6·过闸制未实装
- [ ] 🟡 DSL求值轨迹trace钩子（6.58求值器冻结前穿trace context过每个eval节点） ❓-P0-6·钩子未穿
- [ ] 🟡 保真度档落血统（导入保真度档若影响落库字段集→档决策落实例血统元数据） ❓-P0-6·档落血统未实装
- [ ] 🟡 导入保真度三档（compat_strict/compat_plus/native·含AA3 §1·TavernHeadless） ❓-P0-6·三档判定未实装
- [ ] 🟡 ⑮原生卡包导入通道分流（L0后判型·manifest原生声明+semver+Zod全过=跳L1直入） ❓-P0-6导入通道分流·未实装
- [ ] 🟡 三十·卡格式 卡关系声明过五道闸+Z2对账闸·缺方向槽→作者警示 ❓-P0-6·关系声明过闸未实装
- [ ] 🟡 N4悬案 遗产不跨枝（默认禁·只许知识/称号/血脉·过第④闸钳制） ❓-P0-6导入闸·遗产钳制未实装
- [ ] 🟡 第三批落地·3-9B 区域键（地图.地点.类别区域级）入受治理键空间·第②闸+导入闸归一 ❓-已写入蓝图·归一实装未落
- [ ] 🟡 第三批落地·3-8B-③ 全库grep旧路径+一致性脚本diff归零（独立PR） ❓-独立PR·grep实装未跑
- [ ] 🟡 酒馆·RAG兼容闸（换嵌入模型必重算向量·导入闸警示「向量库与embedding不匹配」） ❓-P0-6酒馆导入闸·未实装
- [ ] 🟡 命名实体音译漂移·写入侧（实体键唯一真值+别名表集中登记） ❓-P0-6·别名解析未实装
- [ ] 🟡 mod发布前静态校验+试算闸（引用键存在/类型/除零/选择器空集·dry-run轨迹预览） ❓-P0-6·试算闸未实装
- [ ] 🟡 覆盖作用域闸·导入侧（携带SystemPrompt覆盖校验仅命中叙事条目·命中记账=拒收+警示） ❓-P0-6·覆盖作用域闸未实装
- [ ] 🟡 真值绑定提示（命中真值绑定模块提示「数值由引擎账本接管·仅样式生效」） ❓-P0-6·真值绑定提示未实装
- [ ] 🟡 接预设模块分类器·破限引子（思维链锁/破限引子类模块归叙事皮肤放行·按模型族归位） ❓-P0-6·引子归位未实装
- [ ] 🟡 预填随专家模式门（community档玩家覆盖串可携带自定义assistant预填+CoT引子） ❓-P0-6·预填门未实装
- [ ] 🟡 规则补丁冲突套娃（合并策略每键声明·优先级降序 官方/作者/玩家·冲突出预览报告） ❓-P0-6·合并语义进键schema未落
- [ ] 🟡 S3·6.59·繁简 繁简只警示（需简繁对照表·只warn·governedKeySpace已留TODO） ❓-P0-6·繁简对照表未落
- [ ] 🟡 6.76续·P1自动代写重大不可逆决策安全地板（G3/G4/M5/二审异步等·H-c-3已接P7-5e·余项未完） ❓-依赖P0-8叙事校验闸·二审异步等未完
- [ ] 🟢 V5·6.58 15语义动词缔结/解除对称性审计+派生量落实值红线复核 ❓-P0-6·对称性审计未实装
- [ ] 🟢 警示族打包（E1b零成本宿主媒介/J2b振荡对/H1年化>100%/G7冷却0拦截器·同一警示管线一次实装） ❓-P0-6·警示管线未实装
- [ ] 🟢 AA4 JS保留键黑名单（__proto__/constructor/prototype）并入S3双卡口（余面·actor.ts内部record面） ❓-P0-6·黑名单并入S3未接
- [ ] 🟢 G8·6.43 回想截断注释（parent链拼接在祖先块按子节点父快照拍号截断·禁fork后幽灵行） ❓-P0-6·6.43注释未补

*(P0-7 梯队0-6未覆盖·待P0-7-remainder处理)*
- [ ] 🟠 F4·6.56 D段零await同步临界区+CI静态检查+看门狗作用域明文 ❓-P0-7结算·D段同步临界区+CI检查未实装·梯队0-6未覆盖
- [ ] 🟠 被动到期不参与截断·拍末清退（P0接受积分误差/P1分段积分选项） ❓-P0-7结算·被动到期拍末清退未实装·梯队0-6未覆盖
- [ ] 🟡 S4·6.59 归一时点钉死=单一写入口（读取点永不再归一） ❓-P0-7·S4归一时点未落·梯队0-6未覆盖
- [ ] 🟡 K7·6.52 种子载荷埋点快照（永不回查包） ❓-P0-7结算·K7种子载荷快照未实装·梯队0-6未覆盖
- [ ] 🟡 sandbox暂存原子性·对撞⑤（工具级联轮内原子commit·不得跨轮commit·依赖J1不动点） ❓-P0-7结算·sandbox原子commit未实装
- [ ] 🟡 M7·6.50 模糊预感确定性采样 ❓-P0-7结算·M7模糊预感采样未实装·梯队0-6未覆盖

---

## §4 UNBLOCK HOOKS

```
八场景复验完成       → M-a, M-b, M-c, M-d（纵切体检）

P0-7-start完成      → F-a(partial·effect生产者), H-c-3, H-c-4,
                       G7, V3展开器(runtime), effect-过闸,
                       L-21(partial·effect活线), K-a(Q批+V3写入口侧),
                       P0-7-remainder

L-9 effect          → L-17(executor侧·P0-4接线), L-27(executor侧·P0-4接线),
executor接线          L-19(executor+任务schema)

DSL text parser     → D-a(§1·已授权待实装), D-b(§1·已授权待实装),
实装（已授权）        S-1(§1·已授权待实装), K-a(V3谓词求值侧·合并P0-7后做)

P0-3分段机器        → F-c(U3指纹版本分段) ✅ 已触发·F-c 层2 完结(657fa1a)

mod生态路径II ✅    → G-b ✅, G-c ✅, G-d-registry ✅, G-e ✅, S6 ✅, D-2 ✅, D-3 ✅

crypto路径拍板      → H-a（选C=归hosts则等P0-11）

P0-8完成            → L-16, L-18, L-24-结构, L-26, L-28-枚举, L-29

P0-9完成            → B6-I(S3写卡口接存档口), G2, U1

P0-11完成           → H-b, H-c-2(CSP sandbox), P1

K-a完成             → P0-6焊死·转P0-7正式

P2完成              → I-b-盐3(第三盐+离场契约指纹), offstageSettler接线
```

---

## 快速参考：关键指标基线（HEAD=c02ce1f·archive活常量fix）

| 指标 | 值 |
|------|-----|
| test | 3342（65 test files · +59 纵切Demo·m_webdemo.test.ts） |
| tsc | 28（reconcileGate TS2459已修·baseline） |
| lint | 220 errors（baseline·勿新增） |
| schemaKeys | 52 |
| 指纹 | 84（fingerprintManifest BUNDLE20/PRESET10/SNAP5/EXCL49=84条目·demo不进指纹） |
| REPLAY-01 | 24 |
| C2 chaos | 17 |
| 黄金向量 | 5c1d0233 / 63b3e729 / db10d5c7（逐位恒等·勿重生成·Option B確認済）|
