# CLAUDE.md — AI 文游人生模拟器 V4.1（CC 对接文档）

## 0. 我是谁 / 你是谁
- 我（用户）：非技术 solo 开发者，vibe coding。你（CC）是终端里的 Claude Code 编码 AI。
- 交付铁律：**指令/代码一律在对话里 PASTE，不要写成文件让我自己找**；诊断用 shell 命令可以直接给。
- 我会把你的产出转贴给一个「排程审计 AI」（Notion 侧）做验收，所以你的验收报告要 itemized：改了哪些文件、DoD 证据、测试号增量、lint 状态、blueprint diff。

## 1. 项目本质（护城河）
确定性、可重放的人生模拟引擎，用 LLM 包叙事，但**严格无作弊记账**（账本守恒、知情过滤、指纹重放）。护城河 = 「LLM 管文采、引擎管事实」，事实层任何时候不被叙事旁路。对标但要赢 SillyTavern。

## 2. 当前位置
- 已过 M5 签收，处于 **P0-6 焊死前 schema 黄金窗口收尾**。
- **基线 commit：4e1e213**（M5 纵切签收，69 files / +7952，hosts/slice 全树首次入 git）。
- **effect 包格式批已完成**（2026-06-16）：扩既有 `intervention_pack_v1Schema`，1772/1772 绿（33 files，+12），blueprint diff 归零。
- 「焊死」定义：一旦 P0-6 五道闸/派生白名单/段结构写死，schema 和指纹契约就不再零迁移。所以焊死前要**穷尽 schema 黄金窗口**。

## 3. 仓库与命令
- root：`/Users/xxx/Projects/AI_LIFE_SIMULATOR`
- 包：`packages/core`（引擎/schema/指纹/replay/chaos）；`hosts/slice` = `@ai-life-sim/slice@0.0.1`（M5 纵切 demo）。
- 运行：`pnpm dev` → `tsx server.ts`（dev:web）或 `tsx index.ts`。Node v24.16.0、esbuild@0.28.1、NodeNext ESM（import 带 `.js`）。
- 测试：`pnpm test`（当前 1772 绿 / 33 files，fingerprint 84）。`pnpm lint`（141 个既存噪音，非阻塞；新改文件必须 0 错误）。
- soak：`pnpm --filter @ai-life-sim/slice soak -- --seed N --runs 1`（debt 不变量：试算平衡/三向同额/清偿能力闸 fail-closed）。

## 4. 红线（绝对不碰）
确定性引擎 / 指纹取材计算 / 结算管线 / canonicalize / RING_K / 定点数学库（`packages/core/.../fixed.ts`：fixedLn/fixedExpm1/fixedPow/fixedSqrt/stableProb）。
确定性六禁（CI 已上）：禁平台 Math.pow/exp/log（用 fixed.ts）、禁 Math.random、禁 localeCompare/Intl.Collator、禁裸 JSON.stringify（用 canonicalize）、禁平台 .normalize（用钉版 NFC 15.1.0）。
- 新接口先 stub + 编译期断言：核心调用（记账/检定/谜底校准/结算）结构上**不得含**越权字段（覆盖串/预填/endpoint/deltas）。
- 凡新增 schema：默认 `.optional()`、不挂 RootSchema/迁移管线 = 零迁移；改判定输入的字段进指纹 bundle，叙事/偏好层字段进 FINGERPRINT_EXCLUDED_FIELDS。

## 5. effect 包 schema 现状（已落，勿重做）
`packages/core/schema/memory.ts` 的 `intervention_pack_v1Schema`（= 蓝图 intervention_pack.v1）：
- 旧三字段 `agent_delta` / `money_delta` / `flags_add` **未动**，`.strict()` 保留。
- 新增全 `.optional()`：
  - `pack_id: z.string().default('')`（同 mod 注册表口径，K6 收紧留 P0-6，**勿预先收紧**）
  - `deltas: array({ path, op, value, max_delta? })`（path = 字符串占位待 6.59 收紧；op = set|add|sub|clamp|lock；value = 数字或 DSL v1 表达式串；max_delta 留五道闸钳制）
  - `trigger: z.string().optional()`（DSL v1 谓词串，同 lore 文法）
  - `side_effect_level`（复用**新提取的共享枚举** none|sandbox|irreversible，已替换核心调用条目里原内联 enum，零行为变化）
  - `content_hash: z.string().optional()`（占位，留 P0-6 进 B1c 指纹）
- 仍**未挂** RootSchema / migrate.ts，无运行时消费者（**故意预埋·不接线**）。测试在 `packages/core/tests/schema.test.ts`。

## 6. 两道闸（解锁 P0-6 的前置，红着不许往下走）
- 闸一：P0-1~P0-5 全部剩余 bug 跑绿 ✅（已全绿）。
- 闸二：≥6 轮固定引擎雏形 + 第7轮。1–6 轮已留证（六禁 c780c63 / 指纹双向 74 / dry-run 39 / stub 40 / REPLAY-01 八场景 / C2 混沌猴 10 事件类）。
  - **第7轮剩**：① 新字段双写 re-grep ✅（已跑，30+ 字段全单源无双写）；② **AA3 DoD 豁免清单半天会 ⏳ 需用户拍板（你做不了）**。
  - 每落一批新 schema，要把闸二（含 REPLAY-01 八场景 + C2）重跑成 gate 留证、把新对撞面吃进去，全绿才能重新冻结。

## 7. 焊死前 backlog（按顺序，每批独立）
**总原则：零迁移的现在焊；动闸/迁移/存储形状的留焊死时刻。红线见 §4。**

1. **动词表批（NEXT，先设计后编码）** — 全仓不存在，从零 create。需先拍板：目标槽选择器文法（建议复用 DSL v1）+ V5 哪些动词配对称解除腿。schema：动词表条目 = 目标槽类型(单实体键|选择器串) + 缔结/解除腿(对称对|单向flag) + 越界?标记。全 optional/零迁移。**不糊最小版。**
2. **受治理键空间 6.59 批** — 注册表 + 归并表 + 母题写入口注册闸，地点.类别(区域级)入册，码位规范化进双闸(NFC+去零宽+全半角折叠+trim)+JS保留键黑名单。加校验不改存储=零迁移。之后 `deltas.path` 才从 string 收紧到 registry 校验（单独 add-constraint 提交）。
3. **effect 包 content_hash 进 B1c 指纹** — 接进 `FINGERPRINT_BUNDLE_MEMBERS`（不进排除名单）+「内容变→指纹变」property 断言 + 热加载点同步 + AA6 名单登记。指纹补全最致命一条。
4. **安全边界钉死** — 反代 baseURL 导出剥离 / IM4 第三方 JS 同源隔离 / 玩家主权安全地板（重大不可逆决策强制需确认，凌驾抢话档）/ effect 包过五道闸钳制（单次Δ上限·补丁取严先于内容·money_delta 不穿透账面下界锁）。焊死前能做的是 schema 位+编译期断言+明文契约，闸逻辑随 P0-6。
5. **K6 pack_id 收紧批（唯一非零迁移，排最后）** — 单一权威 pack_id（废三级 fallback）+命名空间正则白名单+自环拒收，含 mod 注册表既有字段=要迁移。effect 包 pack_id 跟随 K6 一起收紧，**绝不预先收**。独立 PR、独立可回滚、不与零迁移批混。
6. **stub+编译期断言 / 闸二重冻结 / AA3 半天会** — stub 三件套已落；闸二第7轮 re-grep 已跑；剩=每批落地后重跑闸二留证 + AA3 会议（需用户）。

## 8. 关键文件锚点
- effect 包 schema：`packages/core/schema/memory.ts`（`intervention_pack_v1Schema`，§5）。
- DSL v1：`packages/core/engine/dsl/eval.ts` + `fuzzer.ts`（冻结 AST；fixedPow/fixedSqrt 必 import fixed.ts，禁第二实现）。
- 指纹：`fingerprintManifest.ts` / `rng.ts` / `preset.ts` / `fingerprint.property.test.ts`。
- replay：`packages/core/replay/`（types.ts 十类输入 / engine.ts replayTick 纯函数 / AA1 partitionTickets 弃过期世代 / replayRoute 读冻结路由）。
- chaos：`chaos/scheduler.ts`(prand.xorshift128plus 同seed跨机同序) + `invariants.ts`(I1单写者/I2账本守恒/I3路由冻结/I4世代单调/I5已结算单调/I6指纹纯函数)。
- slice：`hosts/slice/server.ts`(~715行, per-entity 账本: PC=pc_linjiu/NPC_WANG=npc_wang/NPC_HONG=npc_hong, INITIAL_BALANCES 总230, assertTrialBalance, handleAction 检定/还账)；`fixture/world.ts`(buildWorld 精简结构, `export const SECRET_S1="S1"`, 秘密母题"窝藏通缉旧友"严重度70, filterSecretsForPOV=唯一正典)；`tests/m4.test.ts`(7组28测试)；`scripts/soak.ts`(debt不变量, 王掌柜本金200→13 逼出三分支)。
- 已知类型债（非护城河，P1 前清）：world.ts 重建后 buildWorld() 精简结构与 RootState 差 41 字段 → assemble.ts/index.ts/server.ts TS2345，vitest 不强制类型检查故不影响运行。

## 9. 编码约定
- editFile 原子精确匹配一次；readFile 用 `{path,limit?,offset?}`；终端在 /data 需 `cd /data &&`。
- 页面/模板 HTML 内保留字面 `${...}`。
- 改一处镜像必改对应处（如 normalizeTokenizerModel ↔ server getTokenizerModel）。
- 报告里别 echo 任何 key（旧 API key 已删）。
- 验收报告必含：改动文件清单、DoD 证据(零迁移/测试数/lint/blueprint diff)、scope 红线确认。

## 10. 测试号基线
M0 1486 / M2.5 1603 / M2.6 1631 / M2.7 1704 / M3 1732 / M4 1760(33 files) / **effect 包格式批 1772(33 files, +12)**。fingerprint 84。commits: …4e1e213(M5新基线)。