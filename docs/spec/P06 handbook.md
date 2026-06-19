# P0-6 五道闸主战场 + 导入闸 — 批次切分与排程

<aside>
🎉

闸二全清（AA3 半天会第 7 轮转正 · commit `c185dd6`）→ P0-6 正式解锁。本页 = P0-6 主战场的批次切分、依赖序、每批 DoD 与红线。批次序为我拍的最优序，可随时 拍板 调整。

</aside>

## 🔴 红线（每批恒定·不可碰）

- 不碰：确定性引擎 / 指纹取材计算（`fnv1a32` · `canonicalize` · `hashPresetFingerprint` · `FINGERPRINT_*`）/ 结算管线（`gate.ts` · `assertConservation`）/ `RING_K` / 定点数学库。
- 接指纹函数时只允许 **只读调用**（如 `hashPresetFingerprint`），绝不改其取材字段集（`FINGERPRINT_BUNDLE_MEMBERS` 17 项 / `EXCLUDED_FIELDS` 57 项）。

## 🧭 批次切分顺序（依赖序）

单批一闭环 · CC 一次一 Step · 侦察（读only·回报不猜）→ 拍板 → 执行 → commit 落地才勾。

| 批 | 内容 | 依赖 | 为什么这个序 |
| --- | --- | --- | --- |
| **B1** | K1 两段式加载（SCC 缩点→拓扑序→全集合并→派生白名单） | 批② `c780c63` 白名单 dry-run | 地基 · 死锁级 · K4/K6/K2 全在它之上跑 |
| **B2** | K4 墓碑 + K6 pack_id fire（①自环拒收 ②命名空间化+别名 ③必填收紧 ④`resolvePackId`） | B1（自环拒收要 K1 的图） | pack_id 全链路必须先钉死再往上建 |
| **B3** | K2/K5 semver 兼容校验 | B2 | 版本闸建在 pack_id 唯一性之上 |
| **B4** | effect 包过闸（批③ deferred：聚合 body+挂 RootSchema+`content_hash`+热加载点+AA6 全名单） | B1–B3 | effect 要消费白名单+pack_id+semver |
| **B5** | M2/M3 + S1/S2/S3 + C6 | B4 | 主体闸逻辑 · 待 B5 侦察补全细目 |
| **B6** | 导入闸（批④ deferred 子域 1–4 + 外链三态本地化快照器） | B1–B5 | 导入要复用全部下游闸 + 外链本地化 |
| **B7** | Q 批 + V3 收尾 | B1–B6 | 收口 · 待 B7 侦察补全细目 |

## 📋 每批 DoD

### B1 · K1 两段式加载

- mod/包 依赖图建图 → Tarjan/Kosaraju **SCC 缩点**（真环 → 超级节点·不死锁）。
- **自环拒收**（K6① 联动）：建图阶段检出自环 → 拒收 + 断言。
- 缩点后 DAG **拓扑排序** → **全集合并后一次性派生白名单**（不增量·避免顺序依赖）。
- 批② `c780c63` 的 dry-run 本批转正为正式派生。
- **DoD**：同输入同白名单序（跨机确定）· 环不死锁 · 自环拒收有断言 · REPLAY/C2 不破。
- 🔴 白名单派生只读包元数据 · 不改指纹取材。
- ✅ **完结（2026-06-17·拍板微调）**：依赖图 → Tarjan SCC 缩点 → Kahn 拓扑 → 全集合并派生 → dry-run 转 CI 守卫（`runDryRun(entries?)`）全部就位；**运行时消费接线 defer 到 B6 导入闸首个消费者**（`migrate.ts:1087` `RootSchema.parse` 后 `runDryRun(deriveModAwareWhitelist(lor, reg))` assert）。零 hosts/ 接线 · 零死代码 · commit 5ecc309/1e05ce0/66d9fb4 · 75 测试 · 零漂移。

### B2 · K4 墓碑 + K6 pack_id fire

- K4：⚰️ 拒收落墓碑（AA3 三桶 ⚰️ 语义）· 墓碑记录可审计。
- K6① 自环拒收（与 B1 图联动）。
- K6② IM3 pack_id 进 `governedKeySpace` 命名空间化 + 别名。
- K6③ effect 包 pack_id 必填收紧（批⑤ `memory.ts:317` 已 `refine default('')`，本批转必填）。
- K6④ pack_id 运行时消费 `resolvePackId`。
- 🆕 K6⑤ **record key === pack_id 收紧**（B1 拍板补漏·2026-06-17）：B1 图节点身份暂用 `mod注册表` 的 **record key**（schema 层未强制 key===pack_id·pack_id 后补）→ 本批补 refine 强制 `record key === 条目.pack_id`，不一致拒收 + 落墓碑；迁移期 backfill 对齐既有档。
- 🆕 K6⑥ **能力种类／轨道维度**（QoL 双轨 · 6.78 · 2026-06-17）：mod 命名空间化加 `轨道: gameplay|cosmetic|view|macro` 维度——能力声明驱动闸分流（重轨碰可写键/effect → 过五道闸；轻轨零可写键+零effect+零判定输入引用 → 声明式表现+只读 selector+意图宏）；随 S5 与 `可写键` 贡献字段同位落 schema（详见蓝图 6.78）。
- **DoD**：pack_id 全链路必填 · 命名空间唯一 · `resolvePackId` 解析正确 · 别名可达 · 墓碑可审计 · **record key===pack_id 强制** · **轨道维度静态可判轨**。
- ✅ **完结（2026-06-17 · commit d17fd9a/d7c7518/ef9e570）**：S1 墓碑 schema slot → S2 effect pack_id 必填 → S3 自环/key≠pack_id 拒收落墓碑 + backfill 强制覆盖对齐 → S4 命名空间枚举 +1（'mod包'）+ 别名骨架 → S5 `resolvePackId` + `可写键` 贡献字段 + 轨道维度（gameplay 重轨/cosmetic·view·macro 轻轨·轻轨带可写键拒收）全部就位。运行时接线（轨道闸分流/resolvePackId 消费/可写键消费/命名空间强约束）defer 到 B6/拍板④。2060 测试 · 指纹 84 零漂移 · 零早接线。

### B3 · K2/K5 semver

- semver range 解析 + 兼容校验 · 不兼容拒收。
- **DoD**：版本号解析正确 · 不兼容包拒收 + 落墓碑/降级。
- 🟢 **Step 0 侦察完结（2026-06-17）**：版本/基底契约 两字段已有 schema slot（纯 string·零校验）；墓碑原因 `semver不兼容` 已预留（memory.ts:341）；写入点复用 migrate() 墓碑段（migrate.ts:1104-1127·自环/依赖被拒之后）；红线零交叉（仅动 memory.ts/migrate.ts/loader/tests）。
- 📌 **B3 拍定口径（2026-06-17 · 技术拍板）**：
    - ① **校验面**：B3 主体 = 基底契约 vs `_系统版本` **单 mod 硬拒**（🔴唯一判据·确定性·有 fixtures）。对官方基底包：每个存活 mod 的 基底契约 都须含 `_系统版本` → 交集恒含该点·永不为空 → set-level 求交 moot，不做无谓接线。真正的「同包单实例求交」前提是依赖边带版本区间，B1 依赖只存 id 无此输入 → B3 只交付**确定性 semver 求交纯函数 + 测试**，消费接线 defer（零死代码）。
    - ② **coerce**：**不改** `_系统版本`（真相层·疑入指纹·不可动）；semver util 内确定性 `coerceSemver('4.1')→'4.1.0'`（缺段补 `.0`）仅比较时用；**不**另建会漂移的 `ENGINE_SEMVER` 常量 · 单一真相源 = `_系统版本`。
    - ③ **semver 实现**：**手写最小子集**（承 Tarjan/Kahn/fnv1a32 一脉·零依赖·确定性·全可测）；仅支持 fixtures 的 `>= > <= < =` 比较器 + 空格 AND 组合；遇 `^`/`~`/`||`/prerelease 等不支持语法 → **显式拒绝/抛错** · 绝不静默误判。
    - ④ **K5 范围**：B3 **零 runtime**；取严 merge 整条留 **B5**（消费者注释已 defer B5/P0-6·避免预埋形态错返工）；B3 仅在 schema 留 `TODO(B5)` 注释指向取严 · **不动** intervention_pack 形态。
- ✅ **完结（2026-06-17 · commit acd5f07）**：`semver.ts` 手写最小子集（parseSemver/coerceSemver/satisfies/intersect/validateRange · 零依赖 · 不支持语法显式抛错）；migrate() K6① 墓碑段后追加 K2 基底契约硬拒（coerceSemver(`_系统版本`)+satisfies→false 写 `semver不兼容` 墓碑 · Object.keys().sort() 码点序 · 确定性幂等）；memory.ts 版本/基底契约 加格式 refine；K5 仅留 `TODO(B5)` 注释不动形态。2115 测试（+55）· 指纹 84 零漂移 · REPLAY 22 · C2 17 · 红线 diff 空 · 多 mod 同包求交消费 + K5 取严 merge defer B5/B6（`intersect()` 已就位）。

### B4 · effect 包过闸（批③ deferred）

- effect 聚合函数 body + 接 `hashPresetFingerprint`（只读）+ 挂载 RootSchema + `content_hash` 填充 + 热加载点 + AA6 全名单 fire。
- **DoD**：effect 包过五道闸 · `content_hash` 正确 · 热加载确定 · 指纹只读不改取材。
- 🟢 **Step 0 侦察完结（2026-06-17）**：`intervention_pack_v1Schema`（memory.ts:365-390）字段齐（pack_id/agent_delta/money_delta/flags_add/deltas[]含 max_delta/trigger/side_effect_level/content_hash 占位）·**未挂 RootSchema**；聚合 stub `interfaces/contentPackHash.ts` body=throw（口径已焊：空集→''·算法留本批）；五道闸 fire 在 `securityBoundary.ts` 明文 defer B6 子域4；`hashPresetFingerprint`(rng.ts:212) 的 生效中内容包集哈希 已在 PRESET_FIELDS·只读传入；content_hash/内容哈希 在 EXCLUDED_FIELDS（单条不进指纹·聚合集合哈希才进）；红线零交叉。
- 📌 **B4 拍定口径（2026-06-17 · 技术拍板 · 重定范围）**：B4 = 纯·确定性哈希层（批③ deferred 聚合 stub 实装），不接活线、不开闸、不动存档：
    - ① **范围（#2）**：只实装 `contentPackHash.ts` 聚合 body + `computeEffectPackHash(pack)` 单包 content_hash 计算 + 确定性测试。五道闸 ①-⑤ fire 整体 defer B6 子域4；DoD「过五道闸」措辞按此重定——B4 只交哈希层。
    - ② **存档 vs 运行时（#1）**：B4 **不挂 RootSchema**、不加顶级键（不 bump migration）；聚合写成纯函数吃传入包集合 + barrel 导出。effect 包持久化归宿（存档态·须为 replay 可重建）由 **B6 导入闸**拍定形态——与生产者同批设计，避免预埋错返工。
    - ③ **哈希算法（#3）**：`fnv1a32(canonicalize(pack 去 content_hash 字段))` → 8 字符 hex `padStart(8,'0')`，与 hashJudgmentBundle 同一套格式；直接用 fnv1a32+canonicalize 原语（**不** import rng.ts 的 hashCanonical·保 contentPackHash 单向边界）；**不**用 SHA-256（stubs 里 'sha256:abc' 只是占位 fixture·非格式要求）。
    - ④ **热加载形态（#4）**：纯函数 `computeEffectPackHash(pack)→hash` + 聚合函数；零注册表变更·零状态变更（registerEffectPack/热加载状态机 defer B6）。确定性：同 content 恒同 hash（无 wall-clock/随机·码点序·canonicalize 防键序假阳性）。
    - ⑤ **活线 & 指纹（#2/#5）**：B4 **不**把聚合接进活的 `hashPresetFingerprint` 调用点（杜绝任何指纹漂移）；现有 AA6 84 断言不破·不新增 fingerprint gate 条目；B4 改加**聚合纯函数确定性单测**（同集→同哈希·异集→异哈希·空集→''·乱序无关·键序无关）。活线接入 + 新增 AA6 A-preset「effect packs→指纹变」条目 → **B6**（随全包流一处接线·一处控漂移）。
    - 🔒 **Defer B6**：effect 包存档归宿/持久化 · 五道闸 ①-⑤ fire · 活的 hashPresetFingerprint 接线 · deltas[].max_delta 钳制消费 · 新 AA6 A-preset effect 条目。
- ✅ **完结（2026-06-17 · commit 9e1c830）**：批③ deferred 聚合 stub 实装——`engine/text/fnv1a32.ts` 独立导出 FNV-1a 原语（rng.ts 红线不动）；`interfaces/contentPackHash.ts` 实装聚合 body + `computeEffectPackHash(pack)` 两个纯函数（fnv1a32∘canonicalize · 8 字符 hex · 空集→'' · 码点序 · canonicalize 防键序假阳性）；loader barrel 导出；28 验收测试。2143 测试（+28）· 指纹 84 零漂移 · 黄金向量逐位恒等 · REPLAY 22 · C2 17 · 红线 diff 空。活线接入／五道闸 fire／max_delta 钳制／RootSchema 挂载／registerEffectPack／AA6 effect 条目 全 defer B6。

### B5 · M2/M3 + S1/S2/S3 + C6

- **代号映射（Step 0 侦察实物化 · 2026-06-17）**：
    - **M2/M3 · 6.50**：M2 = 覆写授权源认证（mod 自封天命降级打标记 · `secret.ts:188` 授权源 / `:206` _作弊标记 / `preset.ts:226` 是否作弊 已存在 · 缺天命通道越权拒收规则）；M3 = 规则补丁负面清单（`preset.ts:223-235` 结构在 · 缺结构不变量硬排除字段集 + forward-only 键列表）。
    - **S1/S1b/S2/S3 · 6.59**（全在 `governedKeySpace.ts`）：S3 规范化键码位() 已实装（NFKC+去零宽+trim · :23）缺双卡口 wiring；S1 受治理键空间注册表 + S1b 归并表 schema-only 未挂 RootSchema；S2 仲裁策略 + 母题注册表 仅埋位（注释「绝不实装·绝不接线」）。
    - **C6 · 6.53**：第②闸席位作用域（per-seat 提案资格 · `*席位表` 已存在 · 单机 席位数=1=全权限 · 零影响）。
    - **K5（B3 遗留）**：约束类 op（clamp/lock）取最严 + 内容类 op（set/delta）后载覆盖。
    - ⚠️ 命名空间区分：M2.5/M2.6/M2.7（hosts/ledger/gate.ts 账面三闸 · 红线）≠ 本批 M2/M3。
- 📌 **B5 拍定口径（2026-06-17 · 技术拍板）**：
    - ① **范围**：B5 做 K5 取严 merge + S1/S1b 挂 RootSchema（新顶层 key · 整体可空 · 零数据迁移）+ M2/M3 逻辑编码 + S3 双卡口 wiring + C6 per-seat 谓词（schema/条件层）。**S2 仲裁+母题注册维持 defer B6**（尊重「绝不实装」钉注）。
    - ② **Step 切分**：Step1 K5 取严 merge（最独立·纯函数）→ Step2 S1/S1b 挂 RootSchema（新顶层 key + migration_version bump 无数据迁移）→ Step3 M2/M3（越权拒收规则 + 负面清单字段集/forward-only）→ Step4 S3 双卡口 wiring + C6 per-seat gate② 条件谓词。
    - ③ **S2 归位**：维持 defer B6（仲裁 fire + 母题注册写入口 fire · 与导入闸/多源合并同批）· B5 一字不动。
    - ④ **基线**：B5 验收门以 **2143** 为准（B3 2115 + B4 28）；[CLAUDE.md](http://CLAUDE.md) 待同步 2115→2143。
    - ⑤ **M2 拒收机制**：**写墓碑**（与 K2 semver不兼容 一脉·可审计·不 nuke 整档·运行时靠 rejected[] 不加载）；墓碑原因 enum **6→7 新增 '覆写授权越权'**（schema slot · deliberate 扩展同 S4 命名空间 11→12）；B5 交付拒收谓词 + 墓碑写入 helper（纯·确定性），活的 fire（对导入数据跑）defer B6。schema superRefine 仅管纯结构不变量（M3 forward-only/硬排除直接违例），语义越权判定走墓碑。
    - 🔴 **S3 wiring 漂移红线**：规范化须幂等 · 既有已规范化数据逐字节不变 · 黄金向量零漂移 · 双卡口不得落在任何指纹/红线文件。
    - 🔒 **Defer B6**：S1/S1b registry 成员级 fire · S2 仲裁/母题注册 fire · M2 越权拒收活线 fire · C6 gate② 真 fire · K5 接入导入闸 fire。
- **DoD**：K5 取严 merge 纯函数正确（约束取严/内容后载·确定性）· S1/S1b 挂载零迁移零漂移 · M2 越权拒收谓词 + 墓碑原因就位 · M3 负面清单字段集 + forward-only 守卫 · S3 双卡口 wiring 幂等零漂移 · C6 per-seat 谓词单机=全权限 · S2 维持 defer · 指纹 84 零漂移 · 红线 diff 空。
- 🟢 **Step 1 完结（2026-06-17 · commit 4a33e03）**：K5 取严 merge——`interfaces/interventionMerge.ts`（约束类 clamp/lock 取最严 · 内容类 set/delta 后载覆盖 · 纯函数 · 确定性 · 码点序） + 35 测试。2178 测试（+35）· 指纹 84 零漂移 · 黄金向量逐位恒等 · REPLAY 22 · C2 17 · 红线 diff 空。导入闸 fire / DSL 串 clamp 语义取严（需求值器）/ intervention_pack RootSchema 挂载 全 defer B6。
- ✅ **Step 2 完结（2026-06-17 · commit 6d71770）**：S1/S1b 挂 RootSchema——新顶层 key（受治理键空间注册表 + 归并表）+ `.default({})` 空值（RootSchema 50→52 键 · schemaKeys.size 测试同步）。**护栏更优：未 bump migration_version**——纯 Zod `.default` 加性挂载 · 零数据迁移 · `migrateS1S1b` 两键存在即 no-op · 旧档逐字节不变。四护栏全过（整体可空 / 隐性排除·FINGERPRINT_* 一字不动 / 只挂 slot·成员级 fire defer B6 / 迁移幂等）。2197 测试（+19）· 指纹 84 零漂移 · REPLAY 22 · C2 17 · 红线 diff 空。registry 成员级 fire / 仲裁 / 母题注册 defer B6。
- 🟢 **Step 3 完结（2026-06-17 · commit 03d502c）**：M2/M3 逻辑编码——M2 `interfaces/authGate.ts`（`VALID_OVERWRITE_AUTH_SOURCES=['系统','裁判','玩家确认']` · '天命' 有意排除 · `checkM2Violation` 越权谓词三分支诊断 · `writeM2Tombstone` 纯幂等无 wall-clock）；墓碑原因 enum 6→7 插 '覆写授权越权'（'其他' 兜底仍末位 · 既有序不变）；M3 `interfaces/patchInvariant.ts`（`M3_HARD_EXCLUDED_PREFIXES=['_','$']` · `M3_FORWARD_ONLY_PATHS=['编年史.序号','落账记录.序号']` · 纯谓词 + intervention_pack 挂 M3 superRefine 结构违例立拒）。2260 测试（+63）· 指纹 84 零漂移 · 黄金向量逐位恒等 · REPLAY 22 · C2 17 · 红线 diff 空。M2/M3 活线 fire defer B6。
- 🟢 **Step 4 完结（2026-06-17 · commit 5caaac9）**：S3 双卡口 wiring + C6 谓词——`interfaces/keyNormalize.ts`（`normalizeRegistryKeyNames` 读卡口纯函数·对注册表/归并表键条目跑 规范化键码位()·幂等·已规范化返回同引用；`assertGovernedKeysNormalized` 写卡口纯断言·非规范态返 GovernedKeyViolation 数组不静默改写）+ `interfaces/seatScope.ts`（`checkC6SeatScope` per-seat 谓词·单机≤1 席位退化全权限）。S3 读卡口接线 `migrate.ts`：`RootSchema.parse(normalizeRegistryKeyNames(rawMigrated))`（1 行·对既有全规范态数据 no-op）；写卡口纯断言**不碰 hosts/**（活线接入 defer B6）。2299 测试（+39）· 指纹 84 零漂移 · 黄金向量逐位恒等 · REPLAY 22 · C2 17 · **`hosts/` 零 diff**。S3 写卡口活线 / C6 gate② fire / M2/M3 活线 / S2 仲裁母题 / K5 接入导入闸 全 defer B6。

### B6 · 导入闸（批④ deferred + 外链三态）

- 子域1 导出剥离 fire（`securityBoundary.ts` 敏感键 `['baseURL','apiKeyRef','modelId','protocol']`）。
- 子域2 CSP + sandbox iframe + 净化器。
- 子域3 强制降级「需确认」fire（主权降级 `z.enum(['需确认','凌驾抢话档'])`）。
- 子域4 effect deltas 过五道闸 + clamp/lock。
- **外链三态本地化快照器**（被动资产 ✅保留：导入期本地化快照 + content-hash 去重 · 实时热链 ⚰️ · 失败→🟡占位降级）。

**B6 任务清单（Phase A–K · 替换原 Wave 1–6 · 2026-06-18 · 已并入漏贴全面化）**

> 序＝零迁移 add-constraint 先行 → 隔离指纹红线 → registry populate；真·P0-7 项见末尾边界表，不可前移。逐项 commit 落地才勾。详细 wiring 见下「🆕 补漏清单交叉对照」块。
> 

**Phase A｜收尾已确认**

- [x]  A1 · S3 形式关闭（注释·commit 489593d·2378 绿·零漂移）

**Phase B｜零迁移 schema 补漏批（桶A·焊死前必做·动指纹之前）**

- [x]  B-a · 动词信封 `提案血统?` + 失败工单 Zod schema（Z5 地基·proposal.ts·replay/types.ts 单源派生）✅ commit 637316b·2386 绿·覆写日志 `提案单引用?` 已落 secret.ts:193·⚠ 预求值=.int / 数值槽=number 差异待 P0-7 复核
- [x]  B-b ✅（002e48d schema 已落·f6a3135 测试补全 2388 绿·doc 7165b90/bb30a1f·⚠墙钟 P0-2 须 host 注入+双机恒等排除）· U3a 存档头 `引擎版本谱?`+`迁移戳[]`（嵌 `_存档头`·不动顶层 52 键）
- [x]  B-c ✅（schema 已落 memory.ts:181·嵌 仲裁器·test 1645-1667·观测值=z.unknown 比较/序列化确定性归 P0-7 J3·doc 关闭随 B-d）· G-4 `触发扫描器状态{观测值表, 挂起命中队列}` schema 誊写
- [x]  B-d ✅3d28c2b（三处 z.string()→受治理句柄Schema·2388 绿·actor.ts 新 import 边运行期实测非 undefined·零循环依赖）· TODO序② 字段收紧 `verb.ts:60 标的类型`/`actor.ts:77/99 子类键` → 受治理引用

**Phase C｜导入闸纯 schema/逻辑（Wave 6 零红线·add-constraint）**

- [x]  C-a · **卡格式核验全族（卡-A/B/C/D/组-F）→P1·Phase C-a 撤空**（决策完结 2026-06-18·非本批实装）：导入管线 hosts/tavern=P0-11 空桩·零 L0/§6/lorebook/dedup 代码·无 P0-6 载体；卡-D 亦 →P1——lore=纯 config（非存档/迁移/replay·.optional() 吸收）·三件套指纹归属须等 P0-6 lore 谓词实装才能定 AA6 位（fingerprintManifest:88 连 lore.触发谓词入 BUNDLE_MEMBERS 都还 TODO）·现做=premature 定位；纯函数 stub 防返工·动词表批同款教训。**Phase C 真主体=C-b。**
- [x]  C-b · 键名冻结 enforcement（K2/K3/K4）+ S5 规则引用完整性扫描 + V3 动词目标槽展开 + G7 死亡拦截硬顶 — ✅**Step 0 侦察完结（2026-06-18）· B6 活线 = 0**：四子项 schema/状态机全完结、闸/引擎逻辑全 downstream。K2/K3/K4 enforcement → **Phase E**（随五道闸 key 校验 fire·墓碑原因 enum 扩一条「冻结键改名」复用即可·memory.ts:354–368）；S5 规则引用扫描 → **Phase G**（依赖 S1/S1b registry populate·path II·当前空集 fail-open·无内容可扫）；V3 目标槽展开器 → **P0-6/P0-7**（verb.ts:44 单态已锁·展开=运行时按真键字典序·无随机源）；G7 硬顶处理器 → **P0-7**（一次死亡至多拦截一次=单次扫描取首命中即停）+ 冷卼=0 警示 → **P0-8**（警示族）。**Phase C 关闭**（C-a→P1·C-b→downstream·无 B6 纯 schema/逻辑活）。⚠ [CLAUDE.md](http://CLAUDE.md)「键名冻结 enforcement=B6 活线」为旧信息·与 [bugs.md](http://bugs.md) 矛盾·待 CC 同步删。⚠ **CC 建议的 next（S1/S1b/S2 fire）不可用**：S1/S1b path I 已完（commit 2872c24）·S2 仲裁/母题受阻于 path II registry populate（defer 待 mod 生态）·S3 写卡口 hosts 接线=no-op 触红线（defer）。真正可用 next = **Phase E 活线 fire**（M2/M3/C6/K 接 migrate.ts·无 registry 依赖）。

**Phase E｜活线 fire（Wave 3）**

> ⚠ **执行序更正（2026-06-18）**：本 Phase A–K 字母序 ≠ Wave 执行序（E=Wave3／F=Wave4／G=Wave5／**D=Wave6**／H=Wave6）。真执行序 = C→**E→F→G→D**→H→I→J→K；本轮已把 Phase D（导入闸语义闸·Wave6）下移到 G 后 H 前（与同为 Wave6 的 H 相邻），让列表从上至下＝实际做序（字母待玩家重标）。⚠ 注：G 大半 defer（path II registry populate 待 mod 生态），do-order 上可大半略过到 D。
> 

> ⚠ lore知识库分层**提案闸缺口（CC Phase E Step0 侦察 2026-06-18·已审计采信）**：Phase E「活线 fire」原假设提案闸已存在——实则 migrate.ts = 导入闸（save-load 路径）；M2/C6/K5 的 fire 点是**提案闸（proposal gate·P0-6 五道闸 proposal pipeline·尚未建）**，接 LLM 输出／应用 effect pack 时调用，与 migrate.ts 不同路径不可混接。故 Phase E 在 migrate.ts 的真实活线 = **仅 E-a**（K1 deriveModAwareWhitelist+runDryRun 接 migrate.ts K6 块后 :1195 ＋ modWhitelist.ts:51 轨道过滤「轻轨不贡献可写键」·零迁移·零红线·无 registry 依赖·空 registry trivially pass）；E-b 的 M3 已活（intervention_pack superRefine 随 RootSchema.parse:1157·无需操作）；E-b M2 ／ E-c C6 ／ E-d K5 全 **defer P0-6 提案闸**（migrate.ts 无对应 schema 数据·接=no-op·阻塞源=提案处理管线尚不存在）。⚠ E-a Step1 拟在 migrate.ts dry-run 失败处 throw——此为 live load 路径非仅 CI，须拍板「dry-run=CI-only 守卫（prod 不抛）还是 运行时 fail-closed（抛=schema 回归则拒载·MVP 空 registry 无害）」。
> 
- [x]  E-pre · S3 双卡口 wiring（读 5caaac9 / 写 2872c24）已接
- [x]  E-a · K1/K4/K6 活线消费 + resolvePackId/可写键 + 轨道维度闸分流 ✅**完结 2026-06-18·commit 4d55b5f**（migrate.ts K6 块后 deriveModAwareWhitelist+runDryRun·**fail-closed throw 拒载**〔拍板A〕／modWhitelist.ts 非 gameplay 轨道不贡献可写键／+2 test·test 2390·tsc 28〔旧债−1〕·指纹84/REPLAY22/C2 17·红线空）。**Phase E 的 B6 活线已尽**（E-b M3 已活·E-b M2/E-c C6/E-d K5 → P0-6 提案闸）→ 执行序下一 = **Phase F**。
- [x]  E-b · M2 越权拒收 + M3 负面清单 活线 fire ✅**经 ⊕-3 提案闸 fire（0df7c7a）**：M2 越权 Gate③ pre-check reject-only 已活〔拍板①候选B·writeM2Tombstone 留导入闸〕·M3 forward-only set 值比较已活〔早 intervention_pack superRefine 已活·⊕-3 补 set 值比较〕
- [x]  E-c · C6 gate② per-seat 真 fire ✅**经 ⊕-2/⊕-3 提案闸 fire（0df7c7a）**：Gate② deriveModAwareWhitelist + C6 seatScope·单机≤1 席位降级全放行·⊕-3 补 Rule②③④ 测试
- [x]  E-d · K5 多包合并接提案闸 ✅**经 ⊕-2/⊕-3 提案闸 fire（0df7c7a）**：mergeInterventionDeltas 多包合并统一入闸·⊕-3 补多包验收〔K5 fire 点=提案闸·非 migrate.ts 导入闸〕
- [ ]  E-e · K2/K3/K4 键名冻结 enforcement（导入闸校验·冻结键改名即拒收/墓碑·随 migrate.ts mod-load key 校验 fire·墓碑原因 enum 扩「冻结键改名」复用 memory.ts:354–368·schema 半 P0-1 已结清）— ⚠ **2026-06-18 补**：补漏清单交叉对照「键名冻结/完整性扫描」原仅在 C-b 注释路由至 Phase E、无独立条目；与 E-a 同属导入闸 path（非提案闸·可 B6 fire）✅ **拍板②（2026-06-19·⊕-3 收尾）确认**：E-e 归导入闸 path·⊕-3 不含 E-e（handbook:142 最新·提案闸无历史键对照·M3 已覆盖血统键）·待导入闸 mod-load key 校验 fire（独立于提案闸 ⊕ 链·墓碑原因 enum 扩「冻结键改名」复用 memory.ts:354–368）

**Phase · 提案闸 orchestrator（五道闸 proposal pipeline · P0-6 核心 · 2026-06-18 正式纳批 · 置 E 后 / F 前 · 字母待玩家定）**

> 战略：B6 导入闸侧活线已尽（E-a）；M2(E-b)/C6(E-c)/K5(E-d)/E-e/effect deltas 钳制 的 fire 点全是此管线。CC Step0 侦察（已审计采信）：五闸纯函数组件齐全（②白名单 deriveModAwareWhitelist／③M3 前缀 patchInvariant／④clampLedger·mergeInterventionDeltas／M2 authGate·C6 seatScope·assertConservation 本体 均已实装）·**唯缺 ①computeDelta 路径写入 ②runProposalGate 装配器**·orchestrator 本体 **P0-6-standalone（无 runTick/无 LLM）= B6 可建**。**scope 修正（拍板·已同步补漏清单）**：㈡ 守恒断言闸**排除·defer P0-7**（调用需 getNetAsset 接线＝P0-7·且守恒=结算拍级不变量·非单笔提案级）；㈢ 输入=**K5DeltaEntry[]（+信封元 txn_id/授权源/seatId）**·提案单→动词→delta 翻译 + V3 目标槽展开=单独前端层（V3 展开 verb schema 已 done·可 P0-6 follow-on·不进首个 orchestrator）；㈣ **C6=第②闸**（蓝图6.53·非 Gate①）；㈤ 单信封 atomic-or-rollback=P0-6·**txn_id 组级/到达序/拍首快照预求值（V1/V6/Z5）+ 覆写日志 提案血统·提案单引用（Z3）=P0-7**；㈥ **computeDelta 必过 AA4 JS保留键黑名单 + Gate② 白名单/受治理路径 先于写**（防 `货币系统.账户.__proto__` 路径原型污染·defense-in-depth）；㈦ computeDelta 数值 op 整数/定点-safe（复用 fixed.ts·无 float 漂移）·同信封多 delta 应用序=到达序确定。红线核对 ✅：不触 rng.ts/fnv1a32/canonicalize/gate.ts 本体/hosts/·clampLedger·assertConservation 只调不改。
> 
- [x]  ⊕-1 · computeDelta **只算不写** + setAtPath 写原语（core 最大缺口·拍板③注入bounds/只算不写避 double-write）：`packages/core/engine/proposal/computeDelta.ts`·(state, K5DeltaEntry)→state·点分路径 resolver + set/add/sub/clamp/lock op·**clampLedger 不调（拍板③：注入字段 bounds·移 ⊕-2 orchestrator clamp+单次写）**·**㈥ AA4 保留键拒 + 白名单/受治理路径校验先于写**·computeDelta(state,delta,lockedPaths?)→{path,proposedValue} 只算不写（read+op〔set/add/sub〕+max_delta cap）·setAtPath 不可变递归 spread 写原语·**补 类型校验(op×value×目标类型不匹配 throw)/整数定点(非整数对整数路径拒)/lockedPaths 透传自检(op≠lock∧locked→拒·源=orchestrator)/逐段 AA4 保留键+`_`·`$`前缀自拒(Gate③ defense-in-depth)/路径不存在 throw 不 auto-vivify**·⊕-1A 落地前确认路径段正则实际字符类（CC 报字符类中 `*` 疑为 `_` 粘贴损坏·受治理路径须允许 `_应收`/`_负债`/`_费用` 等 `_` 段过形状校验、写入由 Gate③ 前缀自拒；**已确认（2026-06-18）**：复用 `是JS保留键()`+`路径段命名正则`〔governedKeySpace.ts·禁第二实现〕、computeDelta 自拒 `_`/`$` 前缀路径）·15+ test·零红线 ✅**完结 2026-06-18·commit 1502a22**（test 2424〔+34〕·tsc 28 持平·lint 220〔修 JSON.stringify→引号·命中禁⑤ canonical-serialize-only 但仅错误消息串·不触取材〕·schemaKeys 52·指纹 84/黄金向量·REPLAY 22·C2 17·红线 diff 空。computeDelta 只算不写 + setAtPath 写原语两纯函数·op set/add/sub/lock〔**clamp 不实装·遵拍板③移 ⊕-2 Gate④**〕·类型校验/整数定点〔含浮点+max_delta 浮点拒〕/lockedPaths 透传自检/逐段 AA4+`_`·`$`前缀自拒/路径不存在 throw 不 auto-vivify 全覆盖·34 test。⚠ **⊕-2 待决**：op=clamp 到达 computeDelta 的处理〔建议 throw unsupported-op·clamp 归 orchestrator Gate④〕）
- [x]  ⊕-2 · runProposalGate orchestrator：`packages/core/engine/proposal/runProposalGate.ts`·吃 K5DeltaEntry[]+信封元+state+白名单+席位表 → 串 ①Zod ②白名单(+C6 第②闸+E-e 键名冻结) ③M3 前缀 ④K5 merge → computeDelta(只算返 proposedValue) → **clampLedger(③注入字段bounds·非hardcode)** → setAtPath **单次写**(避 double-write) ⑤单信封原子提交(snapshot+rollback)+基础覆写日志·**守恒断言不在此(P0-7)**·fail-closed 任一闸拒→回滚·15+ test ✅**完结 2026-06-19·commit 171b9b9**（test 2455〔+31 自⊕-1·26 装配+5 验收补全〕·tsc 28 持平·lint 220·schemaKeys 52·指纹 84/黄金向量 5c1d0233·63b3e729·db10d5c7 逐位恒等·REPLAY 22·C2 17·红线 diff 空〔rng/fnv1a32/canonicalize/fingerprintManifest/math/gate本体/RING_K/hosts 全空〕。①Zod→②deriveModAwareWhitelist+C6 seatScope〔E-e=白名单成员校验·无独立函数〕→③getM3Violation→④mergeInterventionDeltas→computeDelta 只算→clampLedger 折叠〔clamp 不进 computeDelta·hardHi=ceiling·±Infinity 三路径逐行证 SAFE 无 NaN/溢出·透支负值不误伤〕→setAtPath 单次写〔避 double-write〕→⑤structuredClone 快照·任一 gate 失败原子回滚·覆写日志 setAtPath 直写 全局._覆写日志 绕 Gate③·时间取 state 纪元分钟确定性。pathMatchesWildcard 自实装·lockedPaths pre-pass 防排序序乱·.js 伴生已 git rm --cached〔仅追踪 .ts〕。M2 fire 留 ⊕-3。）
- [x]  ⊕-3 · 下游 fire 挂入（= E-b/c/d 的统一 fire 落点·提案闸装好后）：M2 越权(Gate③ pre-check) / M3 forward-only set 值比较 / C6(第②闸·单机降级全放行) / K5 多包合并统一入闸·逐项验收 ✅**完结 2026-06-19·commit 0df7c7a**（test 2473〔+18：M2×7+C6×3+K5×1+M3 set×7〕·tsc 28 持平·lint 220·schemaKeys 52·指纹 84/黄金向量 5c1d0233·63b3e729·db10d5c7·REPLAY 22·C2 17·红线 diff 空。runProposalGate.ts Gate③-M2 pre-check + M3 readAtPath 值传递·patchInvariant.ts getM3Violation 扩四参〔path,op,oldValue?,newValue?·向下兼容·forward-only set newValue<oldValue 拒〕·全量授权源修正。**E-e 键名冻结 enforcement 按拍板②剔出 → 导入闸 Phase E-e**〔handbook:142 最新口径·提案闸无历史键对照·M3 已覆盖血统键〕。墓碑写路径=拍板①候选B reject-only〔M2 pre-check 在提案闸·writeM2Tombstone 留导入闸·保「reject⇒state===snapshot 零写」不变量〕。）
- [x]  ⊕-4 · 端到端验收 ✅**完结 2026-06-19·commit 24339b5**（test 2479〔+6 e2e-1..6·49 files〕·tsc 28·lint 220·schemaKeys 52·指纹 84/黄金向量 5c1d0233·63b3e729·db10d5c7 逐位恒等·REPLAY-01 22·C2 17·红线 diff 空）。6 case：e2e-1 全链整合〔3-pack add50+clamp220→220·assertConservation·fingerprint manifest 78 恒等·audit 全字段〕／e2e-2 Gate② fail-closed〔JSON.stringify deepEqual 全状态零写〕／e2e-3 Gate④ fail-closed〔npc_wang add50 后 npc_zzz path-not-found→partial-write 回滚→deepEqual〕／e2e-4 M3 forward-only〔编年史.序号 set 回退·Gate②-whitelist 先于 Gate③-M3 联防拒·state 零写〕／e2e-5 透支负值〔200−300=−100·lo=−Infinity 不 floor·full commit+audit〕／e2e-6 全路径不可变性〔Gate①②③④ reject 后 BASE_STATE 逐字节不变〕。**✅ 小残留（follow-up）已闭（2026-06-19·commit a0d0389·方案 B+）**：e2e-4 断言收紧 `.toContain(['②-whitelist','③-M3'])`→`.toBe('②-whitelist')` ＋ 新增防回归守卫测试（patchInvariant.test.ts 末尾 describe·真实 deriveWritableWhitelist() ∩ M3_FORWARD_ONLY_PATHS===∅·注释「失败即须补真打 e2e·不得删降级」）＋ dead-defense 文档化（patchInvariant.ts 定义处 + runProposalGate.ts:110 调用点）。侦察采信：两条 forward-only 路径顶段不存在于 RootSchema（_编年史 read-only／落账记录条目无序号字段）→ 结构上永不进静态白名单 → M3-at-orchestrator 对其不可达（dead-defense）；方案 A 须改 orchestrator 签名/不变量 → 弃；B+ tripwire 守卫防未来 schema/mod 静默回归。test 2480〔+1 守卫〕·tsc 28·lint 220·黄金向量逐位恒等·红线 diff 空。**🎉 提案闸 Phase 收官（⊕-1~⊕-4 全完结）**——B6 导入闸侧 E-a + 提案闸侧 M2/C6/K5 fire 全落·下一执行序 = Phase L 论文漏洞批 或 导入闸剩项（E-e fire / S3 写卡口 / G registry populate / D 语义闸）。

**Phase F｜指纹红线批（Wave 4·隔离·必先 Step 0 侦察）**

> ⚠ **Step 0 侦察（2026-06-18·已审计采信）**：① 黄金向量 5c1d0233/63b3e729/db10d5c7 = C2 chaos 路线校验和（harness.test·非 hashPresetFingerprint 输出）·F 增删取材成员**不动这三个 hex**；F 影响 = 指纹测试计数 +1/成员 ＋（F-a）schemaKeys（原「重录黄金向量」框架不准·CC 修正采信）。② **hashPresetFingerprint 零生产调用方**（仅 [fingerprint.property](http://fingerprint.property).test·runTick=P0-7 才接）→ F 全批 = 为未来锁指纹契约·无 live 消费者。③ **F-a 「intervention_pack 挂 RootSchema」非 trivial**：B4 已明文 defer effect 包存档归宿「与生产者同批设计·避免预埋错返工」·挂载点（新顶层键 52→53？还是嵌 mod注册表/lore？）+ 生产者（mod 导入/提案闸）未定·且其内容哈希疑已被 B1c 生效中内容包集哈希覆盖——挂载前须拍板挂载点·勿盲挂。④ **F-b/F-c 入指纹两路均须扩 rng.ts hash 函数签名 = [CLAUDE.md](http://CLAUDE.md) 红线 ↔ Phase F「唯一合法扩取材集」批 的矛盾**·须拍板「是否授权 rng.ts 加 optional 参数（仅扩签名·函数体不改·BASE_CTX undefined→既有指纹恒等·additive-only）」；且 F-b handlerRef/F-c 引擎版本 的消费者（判定输入/U3 分段机器）均未建·F-c 无分段机器时注册引擎版本进指纹=任何 bump 全局假分叉（CC 靠 inert 规避·但 inert 成员=低值锁槽）。**结论：Phase F 与 Phase E 同病·大半 consumer-blocked（提案闸/effect 生产者/P0-7 runTick/P0-3 U3 分段机器）·安全可做面极薄·拍板前勿 fire。**
> 
- [ ]  F-a · effect 包活线：接 `hashPresetFingerprint` + 挂 RootSchema + `content_hash` 填充 + 热加载 + deltas 过五道闸钳制 + AA6「effect packs→指纹变」断言
- [ ]  F-b · handlerRef 进指纹 AA6 +「改 side_effects 集→指纹变」断言
- [ ]  F-c · P0-5 U3 指纹版本分段（依赖 B-b·U批最深·与 M6 共用分段机·碰 fingerprint）

**Phase G｜registry populate + 下游 fire（Wave 5）**

- [x]  G-pre · AA4 record JS 保留键黑名单：economy/memory 六面（2cd746e）+ 账户面（3bfa009）+ 拦截器句柄第13槽+解除通道收紧（82e1fbe）
- [x]  G-a · 6-vs-12 命名空间 reconcile（notion-67·populate 前必清）✅reconcile-only·无commit·2026-06-19
- [ ]  G-b · path II populate registry（mod 条目加命名空间键声明）
- [ ]  G-c · S2 跨包仲裁 + 母题写入口 fire
- [ ]  G-d · deltas.path/handlerRef refine 严格化 + AA4 残留（actor.ts 内部 record 面·null-proto 存储层 follow-up）
- [ ]  G-e · S5 规则引用完整性扫描扩维（被规则引用即冻结·依赖 G-b registry populate 有内容可扫·当前空集 fail-open）— ⚠ **2026-06-18 补**：补漏清单交叉对照「键名冻结/完整性扫描」原仅在 C-b 注释路由至 Phase G、无独立条目

**Phase D｜导入闸语义闸（Wave 6 逻辑·下移自原 C 后·见上「执行序更正」）**

- [ ]  D-a · lore 谓词冻结 + 受控接口能力集（R6 a–d/R10）+ Y13 设定/状态分界 + IM3 + L3 人称二元组 + 保真度三档落血统
- [ ]  D-b · DSL v1 文法冻结（照冻结清单 M·1 EBNF）+ S-1 fixture gate（向后兼容已拍板·只补 gate）

**Phase H｜签名 + 外链 + 子域（Wave 6 剩余）**

- [ ]  H-a · 6.74 验签 + DP 验签放行 + 原生卡包通道⑮
- [ ]  H-b · 外链三态本地化快照器
- [ ]  H-c · 子域 1–4：导出剥离 fire / CSP+sandbox iframe / 强制降级「需确认」fire / effect deltas 过五道闸 clamp

**Phase I｜早阶段残留清坑（漏贴桶C·非 P0-6 但 P0-6 收尾前清·可独立穿插）**

- [x]  I-a · P0-4 开场白模态边界单测 + G1 元层开关走组边界（状态机·零指纹）✅18c8576·test 2544
- [ ]  I-b · P0-5 G6 小剧场盐隔离 + 出厂离场契约进指纹+第三盐（碰 fingerprint·可并 Phase F）

**Phase L｜论文新增漏洞批（桶D·P0-6 收尾前清·按目标阶段分组·2026-06-19）**

> 源＝读论文新增一批漏洞（补漏清单各阶段「论文新增／【X篇】」条目·另窗 ❓ 已标阶段/为何 uncheck）；本块只收「焊死前可完成且未被后阶段依赖阻塞」者。排除项（留补漏清单原位不前移）：H篇符号求解器(依赖信念派生)、grounding 度量(→P0-10)、decoder 强制(→P0-8 非阻塞)、坐标哈希派生(→P0-8)、模型升级哈希约束(→P0-9)、信念派生取材进指纹(依赖派生)、召回隔离(→P2 RAG)、概率律范式、quest motif、人设漂移防护、律激活图。逐项完成→cross-check 补漏清单同条 + 本块打勾。
> 

> ✅ **L-4 拍板（2026-06-19 · 已定口径）：不新增「重要度分」字段 · 复用既有 `权重`（memory.ts:32 · number 0-100 default 50）承载 importance 连续分。** 厘清三条「重要性」轴：⑴ NPC.重要等级（4 级 路人/次要/重要/核心 · 蓝图模块 5）= NPC LOD 分级 · 与记忆排序无关（= 用户所指「四个重要等级」）；⑵ 记忆.重要度（memory.ts:25 · 枚举 普通/重要/命运）= **分类闸/防爆门槛** · 保留固定 · 不参与连续排序 · 与权重正交；⑶ 记忆.权重（memory.ts:32 · number）= **已存在的数值场** → 直接承载 importance。论据：Stanford Generative Agents 记忆四要素（摘要/创建时刻/最近访问时刻/importance 分）→ 本 schema 已齐（摘要/发生时间/上次浮现时间/权重）·「缺重要度分」是伪缺口 · 再加 = 三轨（动词表批同款教训）。NPC 记忆 重要度 int(1-3)（actor.ts:347）**不动**（改 = 破零迁移）。
⚠ **实装前 CC 须核实**（主代理无源码读权限）：① `权重` 当前真实消费者——若已是召回排序权重 → importance 纯文档化即可；若死字段/语义冲突 → repurpose 承载 poignancy 仍不新增第三字段。② **L-21 连带**：若 importance 由 LLM 产出 · 须像 detected_amounts 冻进 tick_log 才可重放 · 进指纹前确认「引擎写」vs「LLM 提案值」。
→ L-4（记忆四要素 schema）**结论 = 复用权重 · 无新增字段 · 待 CC 核实权重消费者后即可标焊**。
> 

> 🟢 **⊕-L Step 0 侦察（续）· L-12..L-30 Triage（2026-06-19 · CC 读源 · 已审计采信）** — schema/锚点全定位·无一全实装。
**① 本批 P0-6 可做（P0-6 scope·无跨阶段阻塞·拍板后即焊）**：L-25 跨字段语义 `.superRefine()`（intervention_pack_v1Schema 先例·零接口变更·无争议·可立即焊）／L-22 观测血统（印象/记忆条目 `来源类型?:enum` optional·须拍枚举值+挂层）／L-23 PI 输入分层隔离闸（须拍边界 hosts/ vs schema·可与 L-22 同批）／L-24 命名范围自动修复（结构性修复外移 P0-8）／L-28 Cheating 枚举（结构拦截🔀已覆盖·枚举依赖 L-8）／L-30 新动词 REPLAY fixture hook（可完成性算法外移 P0-10）。
**② 🔀 部分已被前批覆盖（标注·余项仍缺·不勾满）**：L-15 不可逆 flag 🔀 B5（三态状态机 ❌→P0-4）／L-16 指令组边界机制 🔀 P0-4（叙事闸接线→P0-8）／L-24 命名规范化 🔀 B6-S3（语义自动修复仍缺）／L-28 路径+席位结构拦截 🔀 ⊕批（Cheating 枚举仍缺）。
**③ ⏸ 依赖/归他阶段·P0-6 做不完整 → 已移补漏清单标 ❓-(依赖)**：L-12(随 L-1..L-11·P0-2)／L-13(L-1·L-6+P0-3 衰减引擎)／L-14(P0-3)／L-15 三态(P0-4)／L-16 接线(P0-8)／L-17(L-9·L-11·P0-4)／L-18(P0-8)／L-19(L-9·P0-4)／L-20(P0-5)／L-21(L-4)／L-24 结构修复(P0-8)／L-26(P0-8)／L-27(L-9)／L-28 枚举(L-8)／L-29(P0-8)／L-30 算法(P0-10)。
阻塞链：L-4→L-21→指纹锚点 ／ L-9→L-17·L-19·L-27 ／ L-1·L-6→L-13 ／ L-8→L-28 枚举。
> 

> 🟢 **⊕-L Step 0 侦察完结（P0-1 schema 子批 L-1..L-11 · 2026-06-19 · CC 读 12 文件 · 已审计采信）** — schema 锚点全定位 · 无一已实装（无 commit · 待焊）。
**① 可零迁移焊（optional 新增 · 无拍板争议 · 待实装）**：L-2 观测拍号 `observed_at_tick?:number`（actor.ts:540-548 印象条目Schema · 与「获知时间」语义不同 · 无双轨）／ L-5 地点三字段 `容量?:number`+`营业时间?:string`+`活动类型?:string`（map.ts 地点条目Schema · 与 大小:string 互补非双写）／ L-3 `可行走?:boolean`（map.ts 地点条目Schema）／ L-3 资产白名单扩展（preset.ts:504 世界遗产白名单出厂值已有 · 复用无 schema 改动）／ L-11 别名归一（governedKeySpace.ts:156-162 归并条目Schema · 住 键空间归并表 index.ts:177 已入 RootSchema · **禁第二实现** · 稳定 ID `角色ID` actor.ts:391 已有）。
**② 须拍板后才实装**：L-1/L-6 facet 粒度（`性格五轴.facet?` 内嵌 vs 平行 · 社会角色/权重表/δ效应量表挂 preset 玩法预设Schema 不进存档）／ L-2 状态快照粒度（全状态 vs 字段白名单子集）／ L-3 世界圣经（复用 `_lore知识库` lore.ts:97 vs 另建 `world_bible` 顶层 key）／ L-7 激活阈值指纹归属（入 hashJudgmentBundle 判定面 vs 叙事旋钮排除 · preset.ts:435-507）／ L-8 越界分类落点（二审维度条目Schema preset.ts:391-398 vs 独立表 · 枚举 vs 开放串）／ L-9·L-11 precond/effect 命名（verb.ts:57-62 side_effects=受治理句柄 ≠ STRIPS effect · `precond?`+`effect_decls?` vs 扩 side_effects 对象化 · +V3/V5 关系）／ L-10 角色定义外置（mod条目Schema memory.ts:285-328 新字段 vs 复用 preset.ts:317-321 `实体模板库Schema.NPC模板[]` 占位）。
> 

*L · P0-1 schema 黄金窗口（焊死前·零迁移·配 L-12 迁移默认）*

- [ ]  L-1 · 【P–R–B】信念派生输入进 schema：人格 facet 轴＋社会角色定义表＋权重表 w_i,k＋δ 效应量表（派生结果不存·无锚则 NPC 信念只能写死）
- [ ]  L-2 · 认知档案存「观测时状态快照」：每条印象带 观测拍号＋当时快照（治 NPC 离开房间后仍"知道"当前真值）
- [ ]  L-3 · 【G篇】世界圣经＋资产白名单＋可行走坐标枚举进 schema（约束 LLM 取值空间·切片喂"允许取值集合"非只喂事实）
- [ ]  L-4 · 记忆条目四要素 schema：自然语言＋创建拍＋最近访问拍＋重要度分（无重要度维度则召回无法区分"分手"和"刷牙"）
- [ ]  L-5 · 地点 schema 物理规范字段：容量／营业时间／单双人（治 NPC 闯单人厕所／逛已打烊店）
- [ ]  L-6 · 【P–R–B·待拍】人格粒度：5 轴对外＋每轴 facet 子结构可选展开（折中 30 facet vs 5 轴·防与既有 5 轴双轨）
- [ ]  L-7 · 【P–R–B】角色激活阈值字段（>0.6／<0.4）做 config 可空（防写死代码·不进指纹/不可调）
- [ ]  L-8 · 【PANGeA】越界分类法 config 枚举：Off-Topic（时代错置/地域/泛化）＋Cheating（提示泄漏/未来视/物理违规/NPC黑入/越权技能）（防硬编码违规类型不可扩/不可 mod）
- [ ]  L-9 · 【quests篇】STRIPS 任务建模 operator=(name,precond,effect) ＋ Γ 六类约束进 schema（变量类型/对立 opp/唯一性 ∃!/复现重要度/资格/母题·precond=入闸条件 effect=结算）
- [ ]  L-10 · 【P–R–B】角色/信念定义可外置 mod 结构 schema 预埋（防后期 mod 加"巡检员/谏官"被迫改核心 schema）
- [ ]  L-11 · 【L篇/One Life】动词 precond+effect 标准结构 ＋ 实体指代消歧：稳定实体 ID＋别名归一（禁自然语言名当主键·治 "Key"≠"Metallic Key"）

*L · P0-2 migration（配 L-P0-1 新字段）*

- [x]  L-12 · 新增 facet/角色/δ/枚举字段全部可空·旧档落默认＋标迁移推定（防老档迁移后信念字段缺失抛错·PANGeA+P–R–B）✅3294a23
- [ ]  L-13 · 记忆召回 recency 并入 P0-3 统一衰减累积器（指数衰减因子 0.995·与情绪/印象衰减同口径·守"衰减器三处共用"铁律）

*L · P0-3 time core*

- [ ]  L-14 · 时代/历法权威边界＝时代错置校验数据源（校验闸查时间核·不自算·守"core 内无第二处时间换算"·PANGeA Temporal）

*L · P0-4 state machine*

- [x]  L-15 · 【SCORE】物品/角色不可逆状态机 {active/lost/destroyed}：非法转移（无解释复活）在校验闸回滚而非放行·保持前一状态✅b72b1d1·test 2565
- [ ]  L-16 · 叙事语义校验闸/二审/自反思重写走指令组边界·不许拍中途生效（防 silent fallthrough/模态栈错乱·PANGeA #1#3）
- [ ]  L-17 · 【L篇】效果只分 4 类（移动/设属性/建对象/删对象）＋房间不可挂属性·预设"哪些实体可被哪些效果改"白名单
- [ ]  L-18 · 校验失败纠偏重写＝模态内步骤·不新增模态栈深度（防每次纠偏 push 一层超 4 被拒卡死）
- [ ]  L-19 · 【G篇】任务＝显式状态机（START→SEARCHING→RETURNING→COMPLETE）＋可达性检查（无死端/无不可达终局）

*L · P0-5 RNG/检定*

- [ ]  L-20 · 【PANGeA+WhatELSE】校验闸/因果校验器调 LLM 走独立盐隔离（不进主回滚计数器/tick_log·G6 小剧场盐先例）
- [ ]  L-21 · LLM 打的"重要度分"创建即冻结＋进指纹＋永不重算（配 L-4 记忆 schema·防 swipe/重放重打分致召回漂移·同 Z5 冻结纪律）

*L · P0-6 五道闸/导入闸*

- [x]  L-22 · 【memory hacking】认知档案/记忆写入走闸＋血统：标来源（一手观测/二手转述/玩家陈述）·无血统不得升格"事实"（防对话注入假记忆绕单写者）✅3294a23（来源类型enum·活线defer P0-8）
- [x]  L-23 · Prompt injection 隔离闸：玩家输入只进"被观测内容"·永不进 规则/真相/指令 层（与 memory hacking/PANGeA NPC Hacking 同源·训练不可根治·只能确定性层隔离）✅3294a23（架构隔离复核·hosts/红线零变更·运行时输入路由defer P0-11）
- [ ]  L-24 · 【G篇】归一化准入闸＝确定性自动修复＋准入（补缺字段/非法 prefab 引用/越界坐标/对不上分支 ID 确定性修掉或丢弃·非只格式校验·消融铁证：去归一→校验通过率归 0）
- [x]  L-25 · 【F篇】跨字段逻辑依赖校验（schema 闸≠语义/真相闸·"冰原生态+极端高温"照样过 schema·结构有效≠事实正确）✅ab3bb14
- [ ]  L-26 · 【H篇】校验失败闭环：二分搜索定位最小矛盾子集→LLM 翻自然语言反馈→重写·有界重试 ≤3
- [ ]  L-27 · 【L篇】前置条件代码化模板（位置/库存/属性三类直翻代码检查·闸代码化模板）
- [ ]  L-28 · 【PANGeA】越界 Cheating 结构可判部分并入钳制闸/动词白名单（瞬移/凭空获资产/改他人状态·结构可判→P0-6 闸·只能语义判→P0-8 校验闸）
- [ ]  L-29 · 两种模式按子系统指派：模式1 Graph-First（五道闸/结算核心·关键真相/数值）⊥ 模式2 Post-Generation Validation（叙事校验闸/二审·叙事文）·别让 LLM 同点既当作者又当裁判
- [ ]  L-30 · 【L篇】动态新动作可达性/可完成性回归校验（开放动词加一道·防玩家把自己卡死·回归 fixture 半归 P0-10）

**Phase J｜docs/spec 同步批（桶B·随手）**

- [ ]  J-a · G-1 蓝图 4.x 誊写+C3 注释 / 彩蛋池装配器规格一行 / U5 冻结载荷枚举 / MVU 镜像=重建两分 / 各批口径回写决议+docs

**Phase K｜B7 收尾**

- [ ]  K-a · Q 批 + V3 收尾 + 完整八场景复验（REPLAY-01 + C2 + 指纹/黄金向量）

**Phase M｜纵切体检（MVP 纵切端到端体检 · P0-6 收尾后 · 焊死前信心闸 · 2026-06-19 纳批）**

> 源＝[最小可玩样本 · 纵切方案（MVP Vertical Slice · 焊死前契约验证）](https://app.notion.com/p/MVP-Vertical-Slice-1600c896228b47ddaab9b6545e71e2ff?pvs=21)（M0–M5 已 PASS）。定位：P0-6 五道闸/导入闸/提案闸全部收尾（Phase K 八场景复验绿）后，用这条已验证窄路对**刚焊死的 P0-6 契约**（schema/指纹/五道闸/导入闸接口）跑一次端到端体检，把纸面审计兜不住的集成缺口在焊死前暴露。判据＝端到端逐位恒等绿 + 黄金窗口无新增缺口 ＝ P0-6 焊死的真实信心来源（详见纵切方案页 §七）。
> 
- [ ]  M-a · 纵切重接 P0-6 收尾后真接口：M0–M5 薄版组装/结算/五道闸换接 P0-6 正式 `runProposalGate`/`computeDelta`/`clampLedger`/`mergeInterventionDeltas`（禁第二实现·复用收尾后真件）；清 slice 类型债（world.ts `buildWorld` vs RootState 41 字段差·M5 残留）
- [ ]  M-b · 跑纵切方案七拍剧本 + soak（守恒/重放恒等/悔棋恒等/对账 fail-closed/关账门规）对真 P0-6 闸全绿·确定性侧 DoD 不让步
- [ ]  M-c · 体检产出回填：纵切真实触碰 schema 字段标「已运行验证」+ 发现缺口回填补漏清单黄金窗口（焊死前补·不付迁移）+ 跑过场景固化成 REPLAY-01/C2 fixture
- [ ]  M-d · 体检判据签收：端到端逐位恒等绿 + 黄金窗口零新增缺口 → 出「P0-6 焊死信心」结论·绿则继续 P0-7·红则回填后复跑

**⚠ 只能留到 P0-7（不可前移·换窗口务必保留·已在补漏清单 P0-7 段）**

- 守恒接线 getNetAsset→runTick + sink 物化/只进不出 + `_费用` accrual 写 + 双分录原子写（需 runTick）
- D4 种子成熟日全局锚 + 声明域入参（需写结算调用点）
- 级联轮 J1/J6（需 runTick）
- 模态栈三方并发临界 + AA1 在途世代核对（需结算管线+看门狗）
- Z3/Z5 结算逻辑：失败工单冻结 / 条目级双向核销 / 重试通道（schema 地基在 Phase B-a·逻辑挂 runTick）
- 对账闸 hosts/gate.ts（M2.5/M2.6/M2.7·slice 侧·触 hosts 红线）
- G7 死亡拦截器引擎级硬顶（6.49·一次死亡至多拦截一次=单次扫描取首命中即停·effect 处理器·需结算管线·C-b 路由至此·冷卼0 警示另→P0-8·2026-06-18 补）
- 🆕 **补漏清单交叉对照（2026-06-17 审计补入·B1–B5 已交地基/纯函数·本批接活线 fire·避免焊死前遗漏）**：
    - **下游闸活线 fire**：S1/S1b registry 成员级 fire · S2 跨包映射冲突导入期仲裁 fire + 母题写入口注册闸 fire（B5 维持「绝不实装」钉注→本批拍板是否 fire）· S3 写卡口 `assertGovernedKeysNormalized` 接 hosts/snapshot.ts 活线 + 繁简对照只警示 · C6 gate② per-seat 真 fire · M2 越权拒收活线 + M3 负面清单活线 · K5 取严 merge 接入导入闸 · K2 `intersect()` 消费 · 轨道维度闸分流（重轨过五道闸/轻轨声明式）· `resolvePackId`/`可写键` 运行时消费。
    - **effect 包活线（B4 交哈希层）**：聚合接 `hashPresetFingerprint` 活线 + effect **挂载形态待拍**（顶层键 vs 嵌 mod注册表/lore·⚠ F Step0 审计 2026-06-18：B4 已 defer「与生产者同批设计·避免预埋错返工」·内容哈希疑已被 B1c 生效中内容包集哈希覆盖·勿盲挂顶层键致 schemaKeys 52→53）+ `content_hash` 自动填充 + 热加载点同步重算 + AA6 全名单「effect packs→指纹变」断言 fire；deltas 过五道闸钳制（单次Δ上限）+ 受补丁 clamp/lock（补丁取严先于内容·money_delta 不穿透账面下界锁）。⚠ **依赖**：先钉死 `货币系统.账户` per-entity 账本守恒口径（P0-1 slice 实证·Σ全实体(现金+应收−应付)=常数），否则 money_delta 闸边界留洞。（⏳ **shape ✅ commit 2357afb·守恒断言批进行中 2026-06-18**）
    - **AA4 / 键空间收紧**：JS 保留键黑名单（`__proto__`/`constructor`/`prototype`）record 解析层接入（拒收/加前缀·存储层 null-proto 或 Map）· deltas.path/handlerRef refine 由 fail-open 收紧为严格（registry 填充后）· `不可逆Schema.解除通道` 收紧为受治理引用（先补第 12 命名空间槽「拦截器句柄」或归死亡拦截器管线）· handlerRef 集（side_effects/cascade_on_change）进 `fingerprintManifest.ts` + AA6「改 side_effects 集→指纹变」断言 fire。
    - **导入闸本体**：⑮ 原生卡包导入通道分流（L0 后判型·原生声明+semver+Zod 全过=跳 L1·任一失败仅该条目降级回 L1·缺整卡冻结快照作者警示）· DP 验签放行（云端策略包当远程 mod 过同一道闸·6.74 验签+预设模块分类器+警示族·纯声明式禁内嵌 JS R6-a）· 6.74 导入闸验签（作者公钥验内容哈希·验不过拒收/未验证警示·原生卡包通道零豁免）。
    - **卡格式源码核验**（接现有 L0/§6 净化）：卡-A `spec`/`spec_version` 严校 · 卡-C＋正-B 内嵌 `regex_scripts` §6 三选一 + avatar/preset 粒度白名单（默认隔离须显式授权）· 卡-B 未知 extensions/未知宏降级保留不执行 · 卡-D 内嵌 `character_book` 拆进 `_lore知识库` + 计时三件套（sticky/cooldown/delay 锚游戏绝对时间）+ use_regex · 组-F 导入结构校验 + 稳定键去重合并·冲突报警不静默覆盖。
    - **键名冻结 / 完整性扫描**（K2/K3/K4·6.52 + S5·6.59）：键名冻结策略扩展到「任何被存档引用的 mod 键」（P0-1 占位形态 `模板快照?` + 血统只读化 `_来源包`/`_模板引用`/`_模板快照` 已落·冻结闸逻辑本批接）· S5 规则引用完整性扫描扩维（被规则引用即冻结）。
    - **保真度三档落血统**（对撞⑦·半天会 TavernHeadless）：导入保真度档 `compat_strict`/`compat_plus`/`native` 若影响落库字段集 → 档决策落实例血统元数据 + 落库即脱包·档本身不再影响运行（同卡同档同结果）；「宏/条件不支持」纳入档位语义而非一律拒。
    - **其余 P0-6 归位**：G7 死亡拦截器引擎级硬顶（6.49）· Y13 世界书设定/状态分界硬化（实体现状与秘密禁入·含实体名+状态断言条目作者警示）· 增审4 DSL 最小文法冻结（白名单运算符+路径引用+取整接 H7·文法版进指纹随 U3 分段·写求值器前定稿）· lore 谓词冻结/受控接口能力集（R6 a–d/R10·世界信息 P0-6 行）· IM3 文风/维度/剧本键入受治理键空间+pack_id 命名空间化 · L3 人称二元组合法性导入闸校验。
- **DoD**：导入全过闸 · 敏感键剥离 · iframe 沙箱隔离 · 外链本地化确定。

### B7 · Q 批 + V3

- 收尾批。
- **DoD**：待 B7 Step 0 侦察补全后拍板。

## ✅ 排程 checklist

- [x]  B1 · K1 两段式加载（**完结 2026-06-17** · commit 5ecc309/1e05ce0/66d9fb4 · 75 测试 · 零漂移）
- [x]  B2 · K4 墓碑 + K6 pack_id fire（**完结 2026-06-17** · commit d17fd9a/d7c7518/ef9e570 · S1–S5 · 2060 测试 · 零漂移）
- [x]  B3 · K2/K5 semver（**完结 2026-06-17** · commit acd5f07 · 2115 测试 · K5→B5 · 零漂移）
- [x]  B4 · effect 包过闸（**完结 2026-06-17** · commit 9e1c830 · 2143 测试 · 哈希层 · 活线/五道闸 defer B6 · 零漂移）
- [x]  B5 · M2/M3 + S1/S2/S3 + C6（**完结 2026-06-17** · commit 4a33e03/6d71770/03d502c/5caaac9 · Step1~4 · 2299 测试 · S2/活线 fire defer B6 · 零漂移）
- [x]  **B5.5 · 账本 per-entity 化迁移批**（**shape 完结 2026-06-18** · commit 2357afb · economy.ts:81 `账户→z.record(实体键,账户Schema)` + migrate.ts backfill 选项B 空map + whitelistDryRun probe + schema.test.ts · 2299 测试 · lint 220 · 三取材组逐位恒等 · 红线零 diff · 守恒断言 core ✅ 00bb3ed（批A 纯函数）· runTick 接线 defer P0-7 · 六要素补全见 B5.6）
- [x]  **B5.6 · 账本六要素补全 + `_` 双层写保护（破坏性迁移批·焊前·独立 clean diff）**（拍板 2026-06-18）：①费用腿（独立 `_费用` 字段·镜像本期支出形态 {总额,明细}·read-only 双层·accrual 报表流·**不进 getNetAsset**·⊥本期支出现金流·防双写）+ sink 账户（保留实体键常量 SINK_ENTITY_KEY·零 schema·守恒承重·只进不出 invariant defer P0-7）预埋【形态已拍 2026-06-18】②`负债`→`_负债`、`应收`→`_应收` 重命名（nestedFieldLayer `_` 前缀派生 read-only·堵悬空可写·持有/储蓄留 writable）③存货=零字段寄生 `资产条目[类别='存货']`（数量/成本价/现价 已含）④migrate backfill 键名随改（对齐 a06152d/2357afb）⑤验收=双机迁移恒等+二次幂等+三取材组逐位恒等+红线 diff 空。逐币守恒走 A（getNetAsset 注入·assertConservation 红线不碰）；AA4 覆盖 `_应收`/`_负债` record 解析面随 B6（S3 写卡口同批 fire）。依赖 B5.5·在 B6（焊白名单 S3 写卡口）之前。**完结 commit c9e53d5（2026-06-18·审计通过）**：test 2313→2316（净+3=3条 _费用 测试·9 条 应收/负债 原地 rename 无删无并·it() 632→635）·schemaKeys 52·指纹 84 黄金向量逐位恒等·REPLAY-01 22/C2 17·lint 220·双机迁移恒等+二次幂等·conservation.ts 仅 :2 注释变 函数体未动（走A）·写保护实证 deriveWritableWhitelist：_负债/_应收/_费用 含子树全 read-only·持有/储蓄 writable 未误伤。
- [ ]  B6 · 导入闸 **【焊白名单改判·2026-06-18·Step0 侦察后】** 原「焊白名单=S3 写卡口接 hosts/snapshot.ts serializeArchive」**作废**：serializeArchive 吃 SliceSnapshot（无注册表键）→ assertGovernedKeysNormalized 接入=no-op；账户写保护**已由 B5.6 `_双层`在 core deriveWritableWhitelist 焊死**（serializeArchive 是 slice checksum·与写权限无关·触红线）。拆两件归 B6：**(I) S3 写卡口接存档口须接 RootState 层（非 slice snapshot）·hosts ALERT·fail-open·defense-in-depth·靠后**；**(II) AA4 `_应收/_负债/SINK` record 防原型污染（约定库键 mod 可控·`__proto__` 注入·当前零覆盖）= core 账户Schema record key parse-time superRefine·add-constraint 零迁移·pre-weld 4 真内核·优先**。排序：B6→B7→P0-7。**(II) AA4 账户面 ✅完结 commit 3bfa009（2026-06-18·审计通过）**：账户 8 个 record key + 货币系统.账户 entity key 全上 账户键Schema（是JS保留键 superRefine·throw fail-closed）·test 2316→2335（+19 AA4 case）·指纹 84/REPLAY 22/C2 17·红线 diff 空·老档零回退·SINK 不误拒。(I) S3 存档口 + AA4 其余面（币种/汇率/行业 key·deltas.path/handlerRef registry 收紧·null-proto 存储层）仍 B6。
- [ ]  B7 · Q 批 + V3

<aside>
🤝

**交接给 CC 的方式**：一次一 Step · 读only 先侦察（回报不猜）· 绿报后拍板再执行 · commit 落地才在本页勾 · 额度紧时侦察走 plain shell `grep`/`cat`（零 CC 浪费）。每批完成后回写 docs/spec/*.md 对应口径。

</aside>