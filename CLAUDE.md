# AI 文游人生模拟器 V4.1 

## 项目目标
一个**确定性数值引擎驱动**的人生/世界沙盒：引擎管账、LLM 只讲故事、玩法预设定题材。
核心护城河（相对 SillyTavern）= 严格的**不作弊记账** + **可重放恒等**。
本仓库是 **纵切（vertical slice）**：用最小可玩链路（里程碑 M0–M5）压测 schema /
指纹 / 接口契约，**先于 P0-6「焊死」**，提前暴露设计漏洞。

## 目录结构
- package.json            根脚本（dev:slice 在这里，命令必须从仓库根跑）
- packages/
    core/                "中文数字解析规则版"解析器
        src/             extractMoneyAmounts → MoneyAmount[]
                         CHINESE_NUMBER_RULE_VERSION（进指纹的版本常量）
                         CANONICAL_UNITS = {文, 文钱}（规范单位，其余 fail-closed）
        tests/chineseNumber.test.ts
- hosts/
    slice/               纵切宿主（CLI）
        fixture/world.ts        样例世界（林九/王掌柜/红姨/悦来客栈…）
        adapter/openai-compatible.ts   ← LIVE，接 DeepSeek
        adapter/anthropic.ts           ← 已归档
        assemble.ts             prompt 组装
        index.ts                CLI 入口
        gateStructural / gateCoverage  结构闸 + 对账覆盖闸
        tests/m1.test.ts m2.test.ts m25.test.ts
- .env                   gitignored（DeepSeek key，绝不提交）
- .env.example
- docs/spec/             已拍板口径（决议同步处）

## 关键约定（铁律，违反即回退）
1. 单写者：只有引擎能改存档；LLM/前端/玩家一切操作都是"提案"，过五道闸才落账。
2. 确定性六禁（CI 拦截）：禁 Math.random / Date.now（Ring 0）/ localeCompare /
   裸 JSON.stringify（指纹取材必走 canonicalize）/ 平台 Math.pow 等超越函数（走 fixed.ts）/
   平台 .normalize（归一走已钉版 NFC 15.1.0 固定实现）。
3. 对账闸（gateCoverage）= 叙事金额必须被提案覆盖，对不上/认不出一律 fail-closed 降级，
   绝不静默放行（防"叙事说一百万、提案只记十块"的语义漏记）。三层已落：
   - M2.5 汉字数字识别（两文铜钱→covered:false）
   - M2.6 单位 fail-closed（非"文"如块/两/贯→单位不可确认）
   - M2.7 语义/方向（NFKC 入口归一 + from/to + 现金/债权/找零/代付 性质比对；解析不出走 degraded）
   扩展时必须复用同一份解析器（禁第二实现）并 bump 规则版进指纹。
4. 指纹 + 重放：所有判定输入（规则版/单位表/盐值/路由）进指纹；tick_log 冻结每拍盐值/路由；
   同档同 seed 双跑逐字节恒等；重放读冻结值、短路 LLM。
5. fail-closed 优于 fail-open：宁可降级/重写，绝不凭空记账。
6. 能派生的不存储、能开放串的不枚举、所有计时用游戏绝对时间。

## 中文模糊性的工程终局（为什么不靠"填坑"）
结构先行（账本只读结构不读散文）→ 账本守恒（与中文无关的护城河）→
fail-closed 三角校验（文锚 / detected_amounts / proposal 三边一致才放行）→
埋点 + 版本化重放（坑按 A已覆盖/B安全/C真危险/D路由别处 分类，按真实频率增量填，不破老存档）。

## 当前进度（2026-06-16）
- 参见testdemo.md，已绿：M0 / M1 / M2 / M2.5 / M2.6 / M2.7（对账闸三层全绿）
- 测试：1704 tests / 31 files，lint 净（M2.6→M2.7 = +73）
- 下一步：M3 = 拍前快照 ring buffer + 关账态门规 + 存档头校验和 +
  悔棋（回滚拍前快照，含观测值表/挂起队列回滚单元）+ replayTick(REPLAY-01) 接窄路
- 之后：M4（知情过滤最小版 + 一个秘密 + 极简网页 UI）→ M5（玩一整天 5~10 拍 + DoD 验收）

## 运行
- 跑 slice：从仓库根目录 `pnpm dev:slice`（M0–M3 走 CLI；M4+ 网页 `pnpm dev`）
- DeepSeek：base `https://api.deepseek.com`、model `deepseek-chat`、
  env `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`

## 给 CC 的工作纪律
- 每个里程碑全绿后报：测试数 / 文件数 / 增量；不要伪造 commit SHA（没有就用测试数+文件名）。
- 改解析/归一/单位/方向规则 → 必 bump 规则版 + 同步指纹断言。
- 任何"能派生"的新字段先问该不该存；任何判定输入先问进没进指纹。