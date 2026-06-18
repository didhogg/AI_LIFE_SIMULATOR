# economy.md — 账本六要素 · 写保护 · 守恒口径（B5.6 定稿）

> commit c9e53d5 · schema/economy.ts · migration/migrate.ts

---

## 账本六要素（账户Schema 字段集）

| 字段 | 类型 | layer | 语义 |
|---|---|---|---|
| `持有` | `Record<string,number>` | writable | 币种→余额（允许负值=透支） |
| `储蓄` | `Record<string,number>` | writable | 币种→储蓄余额 |
| `本期收入` | `{总额:number, 明细:Record<string,number>}` | writable | 当期现金流入汇总 |
| `本期支出` | `{总额:number, 明细:Record<string,number>}` | writable | 当期现金流出汇总（现金流出时点记） |
| `_负债` | `Record<string,string>` | **read-only** | 债务ID→约定库键（金额真值在约定库·非数值腿） |
| `_应收` | `Record<string,string>` | **read-only** | 应收ID→约定库键（与_负债对称·引用式） |
| `_费用` | `{总额:number, 明细:Record<string,number>}` | **read-only** | accrual 消费报表流·不进 getNetAsset·赊账消费时点记 |
| `被动收入来源` | `Record<string,number>` | writable | 网点/来源→被动收入金额 |
| `资产` | `资产条目Schema[]` | writable | 持仓条目（开放串类别·E1） |

账户存储形态：`货币系统.账户: Record<实体键, 账户Schema>`（per-entity·2357afb 落）

---

## _前缀双层写保护

`nestedFieldLayer`（`whitelistDryRun.ts:60`）：writable 父上下文内，字段名以 `_` 开头 → 自动派生
`read-only`，并向所有子路径传播。无需额外 VERB_TARGET_PROBES 条目。

**B5.6 node 实测（deriveWritableWhitelist）：**

| path | layer | kind |
|---|---|---|
| `货币系统.账户.{id}._负债` | read-only | record |
| `货币系统.账户.{id}._负债.{id}` | read-only | open-string |
| `货币系统.账户.{id}._应收` | read-only | record |
| `货币系统.账户.{id}._应收.{id}` | read-only | open-string |
| `货币系统.账户.{id}._费用` | read-only | object |
| `货币系统.账户.{id}._费用.明细` | read-only | record |
| `货币系统.账户.{id}._费用.明细.{id}` | read-only | number |
| `货币系统.账户.{id}.持有` | writable（未误伤） | record |
| `货币系统.账户.{id}.持有.{id}` | writable（未误伤） | number |
| `货币系统.账户.{id}.储蓄` | writable（未误伤） | record |
| `货币系统.账户.{id}.储蓄.{id}` | writable（未误伤） | number |

动词提案白名单闸见到 read-only 路径 → 拒收。`_负债`/`_应收`/`_费用`
的写入必须经由引擎层（P0-7 双分录原子写）。

---

## 守恒口径

```ts
assertConservation(
  accounts: Record<string, 账户Type>,
  expectedNetAsset: number,
  getNetAsset: (acct: 账户Type) => number,
): void
```

- `getNetAsset` 注入式——core 不解析 `_负债`/`_应收` 等字段语义（`conservation.ts:2`）
- **B5.6 预埋口径（P0-7 接线）**：`getNetAsset = 持有总和 + _应收存量 − _负债存量`（金额从约定库取·接线留 P0-7）
- `_费用` **不进** getNetAsset（accrual 流量科目·非存量）
- sink 账户（`SINK_ENTITY_KEY = '__sink__'`）**纳入** Σ（守恒承重·消耗现金流入 sink·Σ全实体净值不变）
- `assertConservation` 函数体零改动（红线·conservation.ts:38-52 逐字未动）

---

## SINK_ENTITY_KEY

```ts
// economy.ts:99-101
export const SINK_ENTITY_KEY = '__sink__';
```

- 沉没账户约定实体键·挂标准 `账户Schema`
- 守恒承重：消耗性现金支出转移到 `账户['__sink__'].持有`，Σ 全实体净值恒等
- 只进不出 invariant → P0-7 动词层
- 零余额初始化 → P0-7 runTick 接线时物化（本批不迁移）
- 键保留·禁 mod 占用 → B6/AA4

---

## 迁移注记

| 位置 | 处置 |
|---|---|
| `migrate.ts:409`（migrate货币·v31 盲拷贝） | 目标键 `负债` → `_负债`（读旧档来源 key 不动·只改写入目标） |
| `migrate.ts:1124`（backfill 幂等门） | `'应收' in firstRec` → `'_应收' in firstRec` |
| `migrate.ts:1130`（backfill 补填） | `{ ...entity, 应收: {} }` → `{ ...entity, _应收: {}, _费用: { 总额: 0, 明细: {} } }` |
| RootSchema.parse 阶段 | 旧 `应收`/`负债` key 自动 strip（Zod unknown key 剥离）·`_负债`/`_应收`/`_费用` 从 default 补填 |
| `_系统.migration_version` | backfill 触发时 +1（不在指纹取材集·安全） |
