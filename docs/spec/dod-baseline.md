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

### B5 · M2/M3 + S1/S2/S3 + C6

- 主体闸逻辑（M = ? · S = ? · C6 = ?）。
- **DoD**：待 B5 Step 0 侦察补全后拍板。

### B6 · 导入闸（批④ deferred + 外链三态）

- 子域1 导出剥离 fire（`securityBoundary.ts` 敏感键 `['baseURL','apiKeyRef','modelId','protocol']`）。
- 子域2 CSP + sandbox iframe + 净化器。
- 子域3 强制降级「需确认」fire（主权降级 `z.enum(['需确认','凌驾抢话档'])`）。
- 子域4 effect deltas 过五道闸 + clamp/lock。
- **外链三态本地化快照器**（被动资产 ✅保留：导入期本地化快照 + content-hash 去重 · 实时热链 ⚰️ · 失败→🟡占位降级）。
- **DoD**：导入全过闸 · 敏感键剥离 · iframe 沙箱隔离 · 外链本地化确定。

### B7 · Q 批 + V3

- 收尾批。
- **DoD**：待 B7 Step 0 侦察补全后拍板。

## ✅ 排程 checklist

- [x]  B1 · K1 两段式加载（**完结 2026-06-17** · commit 5ecc309/1e05ce0/66d9fb4 · 75 测试 · 零漂移）
- [x]  B2 · K4 墓碑 + K6 pack_id fire（**完结 2026-06-17** · commit d17fd9a/d7c7518/ef9e570 · S1–S5 · 2060 测试 · 零漂移）
- [x]  B3 · K2/K5 semver（**完结 2026-06-17** · commit acd5f07 · 2115 测试 · K5→B5 · 零漂移）
- [ ]  B4 · effect 包过闸
- [ ]  B5 · M2/M3 + S1/S2/S3 + C6
- [ ]  B6 · 导入闸
- [ ]  B7 · Q 批 + V3

<aside>
🤝

**交接给 CC 的方式**：一次一 Step · 读only 先侦察（回报不猜）· 绿报后拍板再执行 · commit 落地才在本页勾 · 额度紧时侦察走 plain shell `grep`/`cat`（零 CC 浪费）。每批完成后回写 docs/spec/*.md 对应口径。

</aside>