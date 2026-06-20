<!-- 执行状态看 STATUS.md，任务清单看 bugs.md。 -->
# HEAD=DSL-parser-commit | 焊死状态=已正式焊死 @ a7c3f69（Notion 审计签收 2026-06-19） | 更新=2026-06-20/CC-DSL-parser窗口

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
- [x] D-a · DSL v1.0 string→AST parser实装 · commit=DSL-PENDING · test=2926(+94)
  - packages/core/engine/dsl/parser.ts — 递归下降 M·1 EBNF v1.0（tokenizer+Parser·parseExpr/parsePred/tryParseExpr/tryParsePred·DslParseError·DSL_GRAMMAR_VERSION='v1.0'）
  - 完整 token集：INT/IDENT/运算符/比较符(含'in')/逻辑词(and/or)/函数名(min/max/clamp/pow/sqrt)/EOF
  - 函数vs路径消歧：fn名后'('→call·否则→path段·中文路径 /^[\p{L}_][\p{L}\p{N}_]*/u 支持
  - 谓词限深1：首compare后遇and/or→解第二compare→再遇and/or→throw DslParseError('谓词限深 1')
  - fail-closed：空串/非法字符/未闭合括号/尾部残余 全部 throw DslParseError（tryParse* → null）
  - packages/core/engine/dsl/eval.ts — 追加 evalPredStr(src,ctx)·追加 DSL_EVALUATOR_VERSION='v1.0'·'in'→false fail-closed
  - packages/core/engine/verbExpand.ts — expandVerbTarget K-a谓词求值侧：tryParsePred+evalPred·字面键优先·无resolver时跳过
  - packages/core/package.json — 补 ./engine/dsl/parser + ./engine/dsl/eval 导出
  - tsc 零新增错误 · gate.ts/conservation.ts/rng.ts 函数体零 diff · 指纹=84/18不变 · 黄金向量逐位恒等
- [x] D-b · DSL v1文法冻结+防双轨（parse路径与fixed.ts逐位恒等） · commit=DSL-PENDING · test=2926
  - 防双轨测试：pow/sqrt/min/max/clamp via parse+eval = fixed.ts 返回值逐位恒等
  - evalExpr/evalPred 全经 parser.ts 路径·禁平台 Math（六禁③）
- [x] S-1 · fixture gate（v1表达式parse+eval逐位恒等 + v2向后兼容断言）· commit=DSL-PENDING · test=2926
  - 10条表达式 fixture（min/clamp/pow/sqrt·含除法/一元/嵌套）+ 8条谓词 fixture（全比较符+and/or）
  - v2向后兼容：全部 v1 fixture 在当前文法下 parse 不 throw
  - 确定性 round-trip：同 AST 双跑求值逐位恒等
  - packages/core/tests/dslParser.test.ts — 92 tests（D-a/D-b/S-1/K-a/in/版本常量）
  - packages/core/tests/fingerprint.property.test.ts — 补 DSL文法版本 bump + 求值器函数库版本 bump → 指纹变 property

---

## §2 WELD QUEUE（零迁移焊敏感·ready）

- [ ] G-d-partial · AA4余面add-constraint·actor.ts内部record面+null-proto存储层（schema superRefine·零迁移·不改schemaKeys） · 焊敏感=schema(actor.ts superRefine add-constraint)

---

## §3 BLOCKED（consumer-blocked / 依赖未满 / 需拍板）

### Phase F（指纹红线批）

- [x] F-a（生产者侧）· content_hash自填充+热加载+AA6 fire · 完结于P7-5c·effectGate.ts（fillEffectPackHash/isEffectPackHashStale/computeEffectPackSetHash）
- [ ] F-a（挂载侧）· RootSchema挂载（嵌mod注册表·拍板④已决·schemaKeys=52不变） · 解锁=P0-7梯队6 effect生产者+caller接线
- [x] F-b · side_effects注册集进指纹(18th BUNDLE_MEMBER)+AA6断言 · 完结于P7-5c·fingerprintManifest.ts+rng.ts additive扩
- [ ] F-c · U3指纹版本分段（与M6共用分段机·碰fingerprint） · 解锁=P0-3分段机器（rng.ts已授权·仅剩此锁）

### Phase G（registry populate 路径II）

- [ ] G-b · path II populate registry（mod条目加命名空间键声明） · 解锁=mod生态路径II
- [ ] G-c · S2跨包仲裁+母题写入口fire · 解锁=G-b
- [ ] G-d-registry · deltas.path/handlerRef严格化（registry填充后） · 解锁=G-b
- [ ] G-e · S5规则引用完整性扫描扩维（被规则引用即冻结） · 解锁=G-b

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
- [ ] S6 · 受治理键空间enumerate populate+S6实装铁律（未注册串=降级非拒收） · 解锁=G-b路径II
- [x] V3展开器(runtime) · 完结于P7-5b·verbExpand.ts（expandVerbTarget Unicode码点序·applyVerbToTargets）
- [x] G7 · 死亡拦截器引擎级硬顶 · 完结于P7-5a·deathIntercept.ts（scanDeathIntercept 首命中即停）
- [x] effect-过闸 · effect包deltas过五道闸 · 完结于P7-5c·effectGate.ts（runEffectGates）

### Phase L（deferred items）

- [ ] L-13 · 记忆recency并入P0-3统一衰减累积器（0.995指数因子·L-1/L-6已✅） · 解锁=P0-3衰减引擎
- [ ] L-14 · 历法权威表+时代错置校验数据源 · 解锁=P0-3时间核
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
- [x] K-a（V3谓词求值侧）· 完结于DSL parser实装·expandVerbTarget DSL谓词筛选+evalPredStr lore触发谓词·commit=DSL-PENDING

### 后续阶段（P0-7+）

- [ ] P0-7-remainder · Z3/Z5/J1/级联轮/模态并发/V1/AA1主接线等结算子项 · 解锁=P0-7-start落地
- [ ] P0-8 · prompt组装+叙事校验闸+信念派生+知情过滤+切片预算 · 解锁=P0-7
- [ ] P0-9 · 存档层G2原子性/U1迁移单元/U3版本分段 · 解锁=P0-7基础
- [ ] P0-10 · 回归测试体系+DoD复验 · 解锁=P0-8+P0-9
- [ ] P0-11 · 双宿主薄壳 · 解锁=P0-10
- [ ] P1 · 酒馆宿主+全生命周期demo+导入器 · 解锁=P0-11
- [ ] P2 · offstageSettler+RAG+多人+第三盐+离场演化 · 解锁=P1

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

P0-3分段机器        → F-c(U3指纹版本分段)

mod生态路径II       → G-b, G-c, G-d-registry, G-e, S6

crypto路径拍板      → H-a（选C=归hosts则等P0-11）

P0-8完成            → L-16, L-18, L-24-结构, L-26, L-28-枚举, L-29

P0-9完成            → B6-I(S3写卡口接存档口), G2, U1

P0-11完成           → H-b, H-c-2(CSP sandbox), P1

K-a完成             → P0-6焊死·转P0-7正式

P2完成              → I-b-盐3(第三盐+离场契约指纹), offstageSettler接线
```

---

## 快速参考：关键指标基线（HEAD=0eed491）

| 指标 | 值 |
|------|-----|
| test | 2832（+61 P0-7梯队6·m_p7tier6.test.ts 61条行为断言） |
| tsc | 28（CC环境30·含2预存于非改动文件） |
| lint | 220 errors（baseline·勿新增） |
| schemaKeys | 52 |
| 指纹 | 84（fingerprintManifest 18条目·P7-6未新增指纹条目） |
| REPLAY-01 | 24 |
| C2 chaos | 17 |
| 黄金向量 | 5c1d0233 / 63b3e729 / db10d5c7（逐位恒等·勿重生成·Option B確認済）|
