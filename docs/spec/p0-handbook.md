# P0 执行手册 · 可操作步骤·执行清单·测试流程

<aside>
🧭

**本页性质**：P0 阶段（核心引擎成型）的**执行手册**——每个任务给出可直接照做的执行步骤、勾选式执行清单、测试流程与参考资源。规格本体见 [「AI 文游人生模拟器」V4.1 全架构蓝图：顶层设计 · 分模块详解 · 沙盒推演范例](https://app.notion.com/p/AI-V4-1-98a02170416943b780cbc8ae1e0a6f67?pvs=21)（尤其第四部分全量变量结构），决策依据见 [「AI 文游人生模拟器」V4.1 修订决议](https://app.notion.com/p/AI-V4-1-a9d51518f9f747a29d9880bcf1d902df?pvs=21) §五落地顺序，总路线见 [「AI 文游人生模拟器」酒馆 → 网页迁移路线图](https://app.notion.com/p/AI-722a1f58f59d409e805585ea76bbf21a?pvs=21)。

</aside>

# 〇 · P0 总览

## 0.1 核心方针（三句话）

1. **core 先行、双宿主薄壳**：唯一重资产是 `core/` 纯 TS 包（Zod schema + 引擎纯函数 + 测试），不含任何酒馆 API 或 DOM；酒馆与网页调试前端都只是宿主。
2. **行为搬家、代码重写**：`schema_new.js`（V3.1）按蓝图第四部分对照表改造为 V4.1 schema；引擎逻辑用 TS 纯函数重写，旧卡实际行为录成 fixture 当回归基准；MVU 框架/世界书/正则不迁移，用 shim 替代。
3. **每完成一个引擎模块回灌测卡一次**，不攒到最后（决议 §五-3）。

## 0.2 任务依赖总表

| 任务 | 产出 | 依赖 |
| --- | --- | --- |
| P0-0 仓库与工具链 | monorepo 骨架 + CI | 无 |
| P0-1 V4.1 schema 包 | `core/schema/` | P0-0 |
| P0-2 migration | `core/migration/` | P0-1 |
| P0-3 时间核 | `core/engine/time.ts` | P0-1 |
| P0-4 状态机 | `core/engine/stateMachine.ts` | P0-1 |
| P0-5 RNG 与检定 | `core/engine/rng.ts` `check.ts` | P0-3 |
| P0-6 五道闸 + 动词表 | `core/engine/gates.ts` `verbs.ts` | P0-1 |
| P0-7 结算管线 | `core/engine/tick.ts` `settle.ts` `trigger.ts` | P0-3 / 4 / 5 / 6 |
| P0-8 prompt 组装层 | `core/prompt/` | P0-6 / 7 |
| P0-9 存档层 | `core/storage.ts`  • 双实现 | P0-1 / 2 |
| P0-10 回归测试体系 | `core/tests/` | 随各任务同步 |
| P0-11 双宿主薄壳 | `hosts/tavern/` `hosts/web-debug/` | P0-7 / 8 / 9 |

## 0.3 P0 退出标准（DoD）

- [ ]  fixture 回归测试全绿（旧卡行为基准）
- [ ]  六不变量 property 测试全绿
- [ ]  「全 LLM 调用必失败」故障注入下仍可从出生跑到死亡
- [ ]  同一份 `core/` 在酒馆宿主与 web-debug 宿主各跑通一整拍循环
- [ ]  V3.1 旧存档经 migration 后通过 V4.1 schema 校验

---

# 一 · P0 任务执行手册

## P0-0 仓库与工具链

**目标**：搭出 monorepo 骨架与 CI，把「墙钟三铁律」「core 无宿主依赖」变成机器强制。

**执行步骤**

1. 建仓库，目录结构：`core/`（schema / engine / prompt / migration / tests）、`hosts/tavern/`、`hosts/web-debug/`、`fixtures/`、`docs/`。
2. 初始化 pnpm workspace + TypeScript（strict 模式）+ Vite + Vitest。
3. 写 ESLint 自定义规则：`core/` 内禁止 `Date.now()`、`new Date()`、`Math.random()`、`window`、`document`、任何 `TavernHelper` 引用。
4. 配 CI：push 即跑 typecheck + lint + test。
5. 把蓝图第四部分、决议 §五、状态机草案导出为 `docs/spec/*.md`，作为 coding AI 的随仓规格。

**执行清单**

- [ ]  monorepo 三包结构建立，`core/` 零运行时依赖（仅 zod / pure-rand 等纯库）
- [ ]  strict TS + lint 禁入规则生效（故意写一个 `Date.now()` 验证 CI 报红）
- [ ]  `docs/spec/` 内规格文件齐备

**测试流程**：CI 上跑一个空的 `expect(true)` 用例确认管线通；提交违禁代码确认被拦。

**参考资源**

- 工程结构先例：[tavern-helper-template](https://app.notion.com/p/tavern-helper-template-376b7725263c819c8379c13369da514d?pvs=21)（含构建打包流程）
- 工具链：[Vite](https://vitejs.dev)、[Vitest](https://vitest.dev)

---

## P0-1 V4.1 schema 包

**目标**：以蓝图第四部分（4.0–4.11）为唯一规格，产出分层 Zod schema，`z.infer` 导出全部 TS 类型——单一真相源。

**执行步骤**

1. 通读蓝图第四部分 4.0 顶层键一览与 🗑️ 整键删除清单，列出 V4.1 全部顶层键。
2. 按层拆文件：`system.ts`（4.1）、`world.ts`（4.2 时间/世界域）、`actor.ts`（4.3 角色层·主角=NPC特例）、`org.ts`（4.4）、`secret.ts`（4.5）、`map.ts`（4.6）、`economy.ts`（4.7）、`memory.ts`(4.8)、`dollar.ts`（4.9 `$层`/`$meta`）、`preset.ts`（4.10 玩法预设配置层）。
3. 每个字段照抄蓝图标注：✅保留 / 🟡重构 / 🔴新增；🧮派生量**不进 schema**（运行时算），🗑️不写。
4. 旧 `schema_new.js`（V3.1，1481 行）仅作对照源：逐键核对蓝图 4.0 对照表，确认没有漏键。
5. `index.ts` 导出 `RootSchema` + `type RootState = z.infer<typeof RootSchema>`。

**执行清单**

- [ ]  4.1–4.10 十个分层文件齐备，顶层键与蓝图 4.0 一一对应
- [ ]  🗑️ 清单键（含 `印象标签[]` 等）确认不存在于新 schema
- [ ]  认知档案含 `印象[]` 条目结构（6.37 制式）、`$涟漪候选` 在 `$层`
- [ ]  默认值齐备：`RootSchema.parse(开局空状态)` 能通过

**测试流程**

1. 单测：每层 schema 用合法样例 parse 通过、非法样例（错类型/越界/未知键）报错。
2. 写一个「最小可玩状态」fixture，全量 parse 通过。
3. 蓝图↔schema 一致性脚本：导出 schema 键树与蓝图 4.0 键清单 diff，差异为零。

**参考资源**

- 规格本体：[「AI 文游人生模拟器」V4.1 全架构蓝图：顶层设计 · 分模块详解 · 沙盒推演范例](https://app.notion.com/p/AI-V4-1-98a02170416943b780cbc8ae1e0a6f67?pvs=21) 第四部分
- 旧 schema 写法与 registerMvuSchema 模式：[MVU ZOD 变量系统集成指南](https://app.notion.com/p/MVU-ZOD-376b7725263c80629581cbc9c9e0587e?pvs=21)、`/data/schema_new.js`
- [Zod 官方文档](https://zod.dev)（discriminatedUnion、catch、default、brand 类型）

---

## P0-2 migration（V3.1 → V4.1）

**目标**：一支纯函数把旧存档迁成新状态，老玩家存档不丢。

**执行步骤**

1. 按细查报告处置表写映射：优先级 = 十对双轨收口 > 主角指针化 > 计时重标定，其余按决议 §五（蓝图 4.11）。
2. 实现 `migrate(v31State): RootState`：逐键搬运 + 重命名 + 结构升格（如 `NPC.印象标签[]` → `认知档案[观察者][目标].印象[]`，来源标记「迁移推定」）。
3. 删除 🗑️ 键；无法推定的新增字段填 schema 默认值。
4. 写 `_系统版本` 升位与幂等保护（迁过的不再迁）。

**执行清单**

- [ ]  十对双轨全部收口为单写入点
- [ ]  主角改指针化（主角=NPC 特例）后旧主角巨容器字段全部归位
- [ ]  计时重标定为纪元分钟整型
- [ ]  迁移结果 `RootSchema.parse` 通过

**测试流程**

1. 用真实旧存档（现役测试卡导出）作为输入 fixture。
2. 断言：迁移后 parse 通过；抽查 20 个代表键值语义不变；二次迁移=幂等。
3. 故障注入：旧档缺键/脏值时迁移不抛崩，落默认值并记日志。

**参考资源**

- 处置依据：[旧变量系统全量细查报告（V4.1 对照）](https://app.notion.com/p/V4-1-0870136aadec4002bb6d0d8509babb03?pvs=21)、[「AI 文游人生模拟器」V4重构整合清单：组织实体 / 地图 / 战斗与战争 / 秘密](https://app.notion.com/p/AI-V4-ce1c4870165e482790c29ca25c19b017?pvs=21)
- 旧初始值语义：[[initvar] 变量初始化 · v2 对齐版](https://app.notion.com/p/initvar-v2-586822249fef499192013119db22ffab?pvs=21)

---

## P0-3 时间核

**目标**：纪元分钟整型 + 粒度模板 + 双时钟 + 衰减累积器，时间语义全引擎唯一出口。

**执行步骤**

1. 实现纪元分钟 `EpochMinute`（整型）与历法换算（年/月/日/时辰，按整合清单附录 C）。
2. 实现粒度模板与 `_本拍跨度` 计算（场景粒度↔日程粒度切换规则）。
3. 实现双时钟（叙事钟/世界钟）与对账断言。
4. 实现衰减累积器：所有「随时间衰减」量（情绪、印象强度、记忆召回权重）统一走 `decay(value, elapsed, rate)`，禁止各模块私算。

**执行清单**

- [ ]  core 内不存在第二处时间换算实现
- [ ]  `_本拍跨度` 为结算唯一时长输入
- [ ]  衰减累积器被情绪/印象/记忆三处共用

**测试流程**：历法换算往返测试（任意分钟数↔历法日期互转无损）；跨年/闰规则边界用例；衰减器数值表 fixture（给定速率与跨度断言输出）。

**参考资源**：蓝图模块 1 + 整合清单附录 A/C；旧推进语义对照 [[mode_instruction] TIME_ADVANCE 时间推进指令 · v2 对齐版](https://app.notion.com/p/mode_instruction-TIME_ADVANCE-v2-0d658edb21ed455daeafbade8512756a?pvs=21)

---

## P0-4 Ring 1 状态机

**目标**：Hub-and-Spoke + 模态栈（≤4）落成代码，六不变量变成运行时断言。

**执行步骤**

1. 按决议「状态机草案」实现单入口 `dispatch(event)`：主循环 Hub + 各模态 Spoke。
2. 实现模态栈：push/pop、深度上限 4、回栈恢复现场。
3. 六不变量写成 `assertInvariants(state)`，每次 dispatch 后强制执行（生产可降级为日志）。
4. 非法迁移表：枚举禁止的状态转移，dispatch 时拦截。

**执行清单**

- [ ]  任意状态下事件要么被处理、要么显式拒绝，无 silent fallthrough
- [ ]  模态栈深度 5 的压栈被拒绝
- [ ]  六不变量逐条对应一个断言函数

**测试流程**：状态迁移表全覆盖单测（每条合法边 + 每条非法边）；随机事件序列 fuzz（fast-check 生成事件流，断言不变量恒真）。

**参考资源**：决议页状态机草案 + 整合清单附录 B；[XState v5](https://github.com/statelyai/xstate)（层级状态机语义参考——结构不复杂建议手写 dispatch，把 XState 文档当设计对照）

---

## P0-5 RNG 与统一检定

**目标**：种子锚定拍号的确定性随机 + `_统一检定` 唯一公式出口。

**执行步骤**

1. 用 pure-rand 实现 `rngFor(seed, tick, channel)`：同存档同拍同通道=同结果（重 roll 不换命运）。
2. 实现 `_统一检定 = clamp(基线 + 熟练×0.4 + 等级×3 + 属性/2 + 情境 − DC, 0, 100)`，修饰通道做成可注入数组。
3. 建检定配方表（数据驱动）：每类检定声明取哪个属性/技能/情境源。

**执行清单**

- [ ]  core 内 `Math.random` 零出现（lint 已拦）
- [ ]  检定只有一个实现函数，所有 Resolver 经它调用
- [ ]  配方表覆盖 P0 需要的检定类型

**测试流程**：同 seed 同 tick 重放 1000 次结果恒等；不同 channel 互不串扰；检定公式数值表 fixture（边界 0/100 clamp）。

**参考资源**：[pure-rand](https://github.com/dubzzz/pure-rand)；蓝图模块 11 与检定公式段

---

## P0-6 五道闸 + 动词表

**目标**：所有写入走「Zod 形状 → schema 派生白名单 → 前缀权限 → 钳制 → 原子提交+覆写日志」，动词表是唯一入口。

**执行步骤**

1. 从 RootSchema **自动派生**路径白名单（不许手维护清单）。
2. 实现前缀权限闸（`$` 前缀仅引擎可写、`_` 配置层规则等，按决议 §三-17 含 `$运气` 开局特例）。
3. 实现钳制闸（数值范围/枚举合法值，复用 schema 元数据）。
4. 实现原子提交：一拍内全部写入先入暂存 patch，校验全过才合并，并落覆写日志（谁/哪拍/旧值→新值）。
5. 实现通用动词 ×4 + 兜底动词，参数校验即五道闸串联。

**执行清单**

- [ ]  白名单由 schema 派生，schema 加字段后白名单自动更新
- [ ]  越权写 `$层` 被拒并留日志
- [ ]  部分失败时整拍 patch 回滚，状态不脏写

**测试流程**：恶意 patch 用例集（错形状/越白名单/越权前缀/越钳制各若干）全部被对应闸拦下且错误码正确；原子性测试（第 3 个写入非法 → 前 2 个也不落盘）。

**参考资源**：旧版动词语义先例 [[mvu_update]变量更新规则 · v2 完整版](https://app.notion.com/p/mvu_update-v2-92e88932ac3a4cdd8251f4a72205802c?pvs=21)；导入校验管线先例 `/data/modpack_manager.js`、`/data/npc_pack_manager.js`；JSON Patch 语义参考 [**# EJS 提示词模板完整工作流指南**](https://app.notion.com/p/EJS-37ab7725263c8072ab53c5223806748c?pvs=21) 的 patchVariables 节

---

## P0-7 结算管线（runTick）

**目标**：拍前快照 → 日程 → 种子 → 触发固定序结算，分量已结算标记防重算。

**执行步骤**

1. 实现 `runTick(state, input): { nextState, events, prompts }` 纯函数：入口先深拷快照（结构共享可用 Immer）。
2. 固定结算序：日程结算 → 事件种子萌发 → 四类触发扫描（阈值/日期/标志/关系）→ 衰减批处理 → 涟漪引擎传播（6.37：一手在场→二手沿关系边两跳×衰减×知情过滤→广域媒体）→ 原子提交。
3. 每个分量打「已结算 tick」标记，重入直接跳过。
4. 全程不调 LLM：LLM 产物只能作为下一拍 input 进来。

**执行清单**

- [ ]  runTick 是纯函数：同输入同输出，无 IO
- [ ]  结算顺序写成显式数组，禁止隐式依赖
- [ ]  涟漪传播尊重 covert 过滤与两跳即止
- [ ]  重复调用同拍 runTick 幂等

**测试流程**

1. 黄金主线 fixture：从出生状态连续跑 50 拍（LLM 全 mock），快照对比基准 JSON。
2. 涟漪专项：构造 A→B→C 关系链，A 当众行动后断言 B 一手、C 二手衰减值、D（无关系）无印象；covert 行动断言零印象事件。
3. property 测试：任意合法 input 下结算后 schema 校验恒通过、不变量恒真。

**参考资源**：蓝图 1.4 数据流 + 模块 2/6；整合清单附录 B′ 运行管线；决议 6.37

---

## P0-8 prompt 组装层

**目标**：上下文组装器 + 知情切片过滤 + 调用类型注册表 + 拒答回退链，取代世界书注入。

**执行步骤**

1. 实现调用类型注册表：每种 LLM 调用声明（输入切片、输出 schema、温度档、回退策略）。
2. 实现切片过滤器：按观察者认知档案（6.12/6.37）裁剪——NPC 决策 prompt 只见其认知投影，不见真值。
3. 实现组装器：模板（字符串模板即可，无需 EJS）+ 切片 → 最终 prompt；structured output 用对应 Zod schema 校验。
4. 实现拒答检测与回退链：解析失败 → 重试 → 降级模板 → 机械兜底（全 LLM 失败仍可推进）。
5. 旧世界书条目逐条登记去向：进组装模板 / 进 schema 默认值 / 废弃（对照表入 `docs/`）。

**执行清单**

- [ ]  每个调用点都在注册表有名字，core 不出现裸 prompt 字符串
- [ ]  NPC 决策切片过不了「真值泄漏」检查（含秘密的字段必须经认知投影）
- [ ]  回退链末端为纯机械结果

**测试流程**：mock LLM 返回畸形 JSON / 拒答 / 超时三类，断言回退链逐级触发且最终拍可结算；切片快照测试（给定状态断言组装出的 prompt 文本与基准一致）。

**参考资源**

- 旧条目动态加载思想（条件化发送=切片过滤前身）：[EJS 动态内容集成指南](https://app.notion.com/p/EJS-376b7725263c80209359f5690ecfe4b4?pvs=21)、[**# EJS 提示词模板完整工作流指南**](https://app.notion.com/p/EJS-37ab7725263c8072ab53c5223806748c?pvs=21)
- 旧指令模板语义：[[mode_instruction] CHARACTER_CREATION 开场指令 · v2 对齐版](https://app.notion.com/p/mode_instruction-CHARACTER_CREATION-v2-bcca38531bd345b88bfb1a286058f8b3?pvs=21)、[[mode_instruction] TIME_ADVANCE 时间推进指令 · v2 对齐版](https://app.notion.com/p/mode_instruction-TIME_ADVANCE-v2-0d658edb21ed455daeafbade8512756a?pvs=21)
- 条目结构与配置语义：[世界书条目编写规范](https://app.notion.com/p/376b7725263c8061a851fda8d1385e77?pvs=21)、[世界书配置规则速查](https://app.notion.com/p/376b7725263c80a39bdbfa3001ababa5?pvs=21)、[Position Reference](https://app.notion.com/p/Position-Reference-376b7725263c801ab9a1d0b7a564e3b5?pvs=21)

---

## P0-9 存档层

**目标**：`Storage` 接口 + 酒馆/浏览器双实现，分模块命名空间，世界域前缀预埋。

**执行步骤**

1. 定义接口：`load(ns)` / `save(ns, data)` / `list()` / `migrateAll()`，命名空间按模块分（角色层/地图/记忆/归档…）。
2. 浏览器实现：Dexie（IndexedDB），大对象分 ns 存，避免 localStorage 5MB 上限。
3. 酒馆实现：酒馆变量读写包一层 adapter。
4. 存档头带 `_系统版本` + 世界域 ID 前缀（6.36 穿越契约预埋），load 时自动过 P0-2 migration。

**执行清单**

- [ ]  core 只依赖接口，两实现都在 hosts 侧
- [ ]  单模块存档损坏不拖垮整档（按 ns 隔离降级）
- [ ]  旧版本档自动迁移后可玩

**测试流程**：内存 mock 实现跑全套读写单测；往返测试 save→load 深度相等；坏档注入（某 ns JSON 截断）断言其余模块正常加载。

**参考资源**：[Dexie.js](https://dexie.org)；酒馆侧变量语义 [酒馆变量](https://app.notion.com/p/376b7725263c8048b326ea6cdc1571fb?pvs=21)

---

## P0-10 回归测试体系（与各任务并行）

**目标**：三层防线——fixture 行为基准、property 不变量、故障注入。

**执行步骤**

1. 从现役测试卡录制行为基准：典型操作序列 + 期望状态快照，存 `fixtures/`（旧卡行为是唯一「已验证好玩」的真相）。
2. 用 fast-check 把六不变量 + schema 恒通过 + 时间单调写成 property。
3. 写故障注入开关：LLM 全失败 / 存档坏档 / 非法玩家输入三套场景脚本。
4. CI 把三层全挂上，任何 PR 必绿。

**执行清单**

- [ ]  黄金主线（出生→上学→工作→死亡）fixture 存在且可重放
- [ ]  每条不变量至少一个 property 测试
- [ ]  覆盖率：engine 目录行覆盖 ≥ 80%

**测试流程**：本体即测试。验收 = CI 全绿 + 故意改坏一个结算顺序确认 fixture 测试报红。

**参考资源**：[fast-check](https://github.com/dubzzz/fast-check)（与 pure-rand 同作者，seed 可复现）；[Vitest snapshot](https://vitest.dev)

---

## P0-11 双宿主薄壳

**目标**：同一份 core 在酒馆与网页各跑通一拍循环；酒馆=第一宿主、web-debug=开发用第二宿主。

**执行步骤**

1. `hosts/tavern/`：Vite 打包 core 为单文件 tavern_helper 脚本；adapter 把酒馆事件→engine 事件、engine 状态→酒馆变量+正则渲染；用 card-generator 管线重建测试卡世界书。
2. `hosts/web-debug/`：状态树查看器（JSON tree 折叠）+ 按钮面板（跳拍/触发事件/灌假 LLM 回复）+ 存档导入导出。
3. 建立「每模块回灌」节奏：P0-3 起每完成一个引擎模块，打包进测试卡跑一次真实对话。
4. 美术级正式前端**不做**（P1 再说），调试前端只求信息全。

**执行清单**

- [ ]  酒馆测试卡可加载、可推进一拍、变量面板数值正确
- [ ]  web-debug 可加载同一存档并显示同一状态树
- [ ]  打包产物体积与加载耗时记录在案

**测试流程**：双宿主一致性测试——同存档同输入序列在两宿主各跑 10 拍，导出状态 diff 为零；酒馆侧用 `--validate` / `--list` 验卡。

**参考资源**

- 酒馆 API 与脚本工程：[TavernHelper（酒馆助手）API · SKILL 参考](https://app.notion.com/p/TavernHelper-API-SKILL-b1f7f78f7deb458aa4fa0c21c289de80?pvs=21)、[酒馆助手接口](https://app.notion.com/p/376b7725263c80088f3dc13f583adefa?pvs=21)、[tavern-helper-template](https://app.notion.com/p/tavern-helper-template-376b7725263c819c8379c13369da514d?pvs=21)、[酒馆助手官方文档](https://n0vi028.github.io/JS-Slash-Runner-Doc/)
- 生成卡管线：[world-book-skill
](https://app.notion.com/p/world-book-skill-376b7725263c81bb8388d4cf430ab90f?pvs=21)（card-generator / query / world-book-create 三脚本铁律）、[场景路由器](https://app.notion.com/p/376b7725263c8014a198cbd45a8ddc61?pvs=21)
- 前端参考：[HTML 前端美化编写指南](https://app.notion.com/p/HTML-376b7725263c80dc8358c74e59330d07?pvs=21)、[前端界面](https://app.notion.com/p/376b7725263c80a38de9e9653d3e06eb?pvs=21)
- 提示词模板扩展（若酒馆壳需 EJS 桥接）：[ST-Prompt-Template](https://github.com/zonde306/ST-Prompt-Template)

---

# 二 · P1 及之后（简化阶段流程）

> 与 [「AI 文游人生模拟器」酒馆 → 网页迁移路线图](https://app.notion.com/p/AI-722a1f58f59d409e805585ea76bbf21a?pvs=21) 总策略对齐：免费静态单机先行 → 内容打磨 → 弱社交 → 社区 mod → 多人 → 付费规模化。每步为下一步留接口，绝不提前建设。
> 

## P1 · 网页 MVP（静态单机）

- 正式网页前端：开局向导（世界装配）→ 主循环界面 → 存档管理；玩家自带 API key 直连。
- 世界书内容全面重写为组装模板源（从同一模板源生成酒馆世界书与网页 prompt，决议 §五-5）。
- 内容基线：开局包 + 事件池铺量（复用 [中国背景事件池（50例：深度现实与残酷波折）](https://app.notion.com/p/50-c1059d9cb8ae46ceaf69d70aea72fdf5?pvs=21) 扩写）。
- GitHub Pages 部署，零服务器成本。
- **退出标准**：陌生玩家不看说明书可完整玩一个人生周期。

## P1.5 · 战旗轻规则三件

- 技能可选字段（射程/范围形状/移动力，零 migration）+ `$战斗暂存` 站位可视化 + 掩体/高低差轻规则。

## P2 · 内容打磨 + 完整战旗 + mod 生态

- TacticalResolver 完整实现 + 地形规则化生成器（地点.地形 + seed → 通行/掩体/高低差）。
- 六类包（游玩预设/皮肤/事件包/NPC 包/机制 mod/分模块存档）对外开放制作规范，校验管线沿用五道闸。
- 玩法预设扩容（推理/狼人杀等待拍板项在此阶段定稿）。

## P3 · 弱社交

- 存档/人生回放分享、排行榜（静态托管 + 轻后端即可）；多人房间生命周期仍不做。

## P4 · 社区与多人

- mod 工坊、多人同场（6.11 观察者键制式与世界域前缀在 P0 已预埋，此处才兑现）。

## P5 · 付费规模化

- 托管 LLM 转发、云存档订阅；core 纯函数层原样上服务器（P0 解耦的回报）。