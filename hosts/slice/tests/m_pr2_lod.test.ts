// PR-2 · LOD 实体化 + 新闻纯认知层 机测
// 测试序：F1~F6（沿 E/F 命名惯例）
// 确定性·seeded·禁 Date.now/Math.random
import { describe, it, expect } from 'vitest';
import { RootSchema, NpcSchema } from '@ai-life-sim/core';
import {
  materializeCoarseNode,
  newsToCognition,
  triggerLodGate,
  isCoarseNode,
  NEWS_CHRONICLE_THRESHOLD,
  type NewsEntry,
} from '@ai-life-sim/core/engine/lodEngine';
import { buildWorld, SAVE_SEED, PC, NPC_WANG, NPC_HONG, EXPECTED_NET_ASSET } from '../fixture/world.js';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { runTick } from '@ai-life-sim/core/engine/tick';

// ── 辅助 ────────────────────────────────────────────────────────────────────

const COARSE_KEY = 'coarse_node_01';
const COARSE_KEY_B = 'coarse_node_02';
const SEED = SAVE_SEED; // 42

/** 在已 parse 的 state 上挂载粗节点 */
function addCoarseNode(s: ReturnType<typeof RootSchema.parse>, key: string, locKey = ''): void {
  s.NPC[key] = NpcSchema.parse({ 姓名: key, 位置: locKey });
  (s.LOD表 as Record<string, unknown>)[key] = { 模块键: key, 档位: '粗' };
}

function baseState() {
  return buildWorld();
}

// ── F1 · materialize 确定性逐位恒等 + 幂等 no-op ──────────────────────────────

describe('F1 · materializeCoarseNode 确定性 + 幂等', () => {
  it('F1-1 相同输入两次结果逐位恒等', () => {
    const s1 = baseState();
    addCoarseNode(s1, COARSE_KEY);
    materializeCoarseNode(s1, COARSE_KEY, SEED);

    const s2 = baseState();
    addCoarseNode(s2, COARSE_KEY);
    materializeCoarseNode(s2, COARSE_KEY, SEED);

    const n1 = s1.NPC[COARSE_KEY]!;
    const n2 = s2.NPC[COARSE_KEY]!;
    expect(n1.属性.体质).toBe(n2.属性.体质);
    expect(n1.属性.智慧).toBe(n2.属性.智慧);
    expect(n1.属性.感知).toBe(n2.属性.感知);
    expect(n1.属性.魅力).toBe(n2.属性.魅力);
    expect(n1.属性.心理).toBe(n2.属性.心理);
  });

  it('F1-2 实体化后 LOD表 档位=实体', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('粗');
    // LOD-B4b: triggerLodGate 写属性 + 写 LOD表·materializeCoarseNode 仅写属性
    triggerLodGate(s, [COARSE_KEY], SEED);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('实体');
  });

  it('F1-3 幂等：triggerLodGate 对已实体化节点调用 → no-op（LOD表 guard·属性不变）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    triggerLodGate(s, [COARSE_KEY], SEED);
    const attrAfter1 = { ...s.NPC[COARSE_KEY]!.属性 };

    // 用不同种子再次调用 → LOD表 guard 阻止重派 materialize
    triggerLodGate(s, [COARSE_KEY], 999);
    expect(s.NPC[COARSE_KEY]!.属性.体质).toBe(attrAfter1.体质);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('实体');
  });

  it('F1-4 不同 key → 不同属性（种子区分）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    addCoarseNode(s, COARSE_KEY_B);
    materializeCoarseNode(s, COARSE_KEY, SEED);
    materializeCoarseNode(s, COARSE_KEY_B, SEED);
    // 同 seed 不同 key → channel 不同 → 大概率属性不全等
    const a = s.NPC[COARSE_KEY]!.属性;
    const b = s.NPC[COARSE_KEY_B]!.属性;
    const allEqual =
      a.体质 === b.体质 && a.智慧 === b.智慧 && a.感知 === b.感知 &&
      a.魅力 === b.魅力 && a.心理 === b.心理;
    expect(allEqual).toBe(false);
  });

  it('F1-5 属性值在合法范围 [0,100]', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    materializeCoarseNode(s, COARSE_KEY, SEED);
    const attr = s.NPC[COARSE_KEY]!.属性;
    for (const v of [attr.体质, attr.智慧, attr.感知, attr.魅力, attr.心理]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('F1-6 不存在的节点 → no-op（不 throw）', () => {
    const s = baseState();
    expect(() => materializeCoarseNode(s, 'nonexistent_key', SEED)).not.toThrow();
    expect(s.NPC['nonexistent_key']).toBeUndefined();
  });
});

// ── F2 · 新闻路径 0 实体化断言 ────────────────────────────────────────────────

describe('F2 · newsToCognition 0 实体化断言', () => {
  const newsEntry: NewsEntry = {
    主体: COARSE_KEY,
    标签: '传闻',
    极性: '负',
    强度: 60,
    维度: '声誉',
    Δ方向: -1,
    量级: 70,
    来源: 'news:test:001',
  };

  it('F2-1 认知层有写（NPC_WANG 认知档案存在新闻主体条目）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    const nowEpochMin = 100;
    newsToCognition(s, newsEntry, [NPC_WANG], nowEpochMin);
    expect(s.认知档案[NPC_WANG]?.[COARSE_KEY]?.印象.length).toBeGreaterThan(0);
  });

  it('F2-2 实体数不变（NPC 键集合不增加）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    const before = Object.keys(s.NPC).length;
    newsToCognition(s, newsEntry, [NPC_WANG, NPC_HONG], 100);
    expect(Object.keys(s.NPC).length).toBe(before);
  });

  it('F2-3 粗节点 LOD 恒为粗（新闻处理后未实体化）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    newsToCognition(s, newsEntry, [NPC_WANG], 100);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('粗');
  });

  it('F2-4 来源类型固定为二手转述', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    newsToCognition(s, newsEntry, [NPC_WANG], 100);
    const imp = s.认知档案[NPC_WANG]?.[COARSE_KEY]?.印象[0];
    expect(imp?.来源类型).toBe('二手转述');
  });

  it('F2-5 粗节点观察者跳过（不写 coarse observer 的认知档案）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    addCoarseNode(s, COARSE_KEY_B);
    // COARSE_KEY_B 是粗节点观察者，不应收到新闻
    newsToCognition(s, newsEntry, [COARSE_KEY_B], 100);
    expect(s.认知档案[COARSE_KEY_B]).toBeUndefined();
  });

  it('F2-6 factFragment 写入认知档案', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    newsToCognition(s, newsEntry, [NPC_WANG], 200);
    const imp = s.认知档案[NPC_WANG]?.[COARSE_KEY]?.印象[0];
    expect(imp?.factFragment?.主体).toBe(COARSE_KEY);
    expect(imp?.factFragment?.维度).toBe('声誉');
  });
});

// ── F3 · 触发闸：接触 → 实体化·无接触 → 不变 ────────────────────────────────

describe('F3 · triggerLodGate', () => {
  it('F3-1 接触粗节点 → 实体化', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    triggerLodGate(s, [COARSE_KEY], SEED);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('实体');
  });

  it('F3-2 无接触 → 粗节点不变', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    triggerLodGate(s, [], SEED);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('粗');
  });

  it('F3-3 接触已有 NPC → no-op（不影响全实体·无 LOD表 条目）', () => {
    const s = baseState();
    const attrBefore = { ...s.NPC[NPC_WANG]!.属性 };
    triggerLodGate(s, [NPC_WANG], SEED);
    expect(s.NPC[NPC_WANG]!.属性.体质).toBe(attrBefore.体质);
    // 全实体 NPC 无 LOD表 条目·triggerLodGate 跳过
    expect(s.LOD表[NPC_WANG]).toBeUndefined();
  });

  it('F3-4 同拍同节点两次 → 只实体化一次（幂等）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    triggerLodGate(s, [COARSE_KEY, COARSE_KEY], SEED);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('实体');
    // 属性值应与单次实体化相同
    const s2 = baseState();
    addCoarseNode(s2, COARSE_KEY);
    triggerLodGate(s2, [COARSE_KEY], SEED);
    expect(s.NPC[COARSE_KEY]!.属性.体质).toBe(s2.NPC[COARSE_KEY]!.属性.体质);
  });

  it('F3-5 多节点批量实体化', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    addCoarseNode(s, COARSE_KEY_B);
    triggerLodGate(s, [COARSE_KEY, COARSE_KEY_B], SEED);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('实体');
    expect(s.LOD表[COARSE_KEY_B]?.档位).toBe('实体');
  });
});

// ── F4 · LOD 档位迁移（粗→实体）正确 ────────────────────────────────────────

describe('F4 · LOD 档位迁移', () => {
  it('F4-1 isCoarseNode 初始为 true', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    expect(isCoarseNode(s, COARSE_KEY)).toBe(true);
  });

  it('F4-2 materialize 后 isCoarseNode = false', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    triggerLodGate(s, [COARSE_KEY], SEED); // 写属性 + 写 LOD表
    expect(isCoarseNode(s, COARSE_KEY)).toBe(false);
  });

  it('F4-3 全实体 NPC isCoarseNode = false', () => {
    const s = baseState();
    expect(isCoarseNode(s, NPC_WANG)).toBe(false);
    expect(isCoarseNode(s, PC)).toBe(false);
  });

  it('F4-4 迁移后无法反向（LOD表 guard 阻止重入·不可降级为粗）', () => {
    const s = baseState();
    addCoarseNode(s, COARSE_KEY);
    triggerLodGate(s, [COARSE_KEY], SEED); // 实体化 + 写 LOD表
    // 再次调用 → LOD表 guard：档位 !== '粗' → skip
    triggerLodGate(s, [COARSE_KEY], 1);
    expect(s.LOD表[COARSE_KEY]?.档位).toBe('实体');
  });
});

// ── F5 · 默认 fixture 零漂移（无新闻·无接触·无粗节点）───────────────────────

describe('F5 · 默认 fixture 零漂移', () => {
  it('F5-1 基准 fixture 无粗节点（LOD表 无 档位=粗 条目）', () => {
    const s = baseState();
    for (const k of Object.keys(s.NPC)) {
      expect(s.LOD表[k]?.档位).not.toBe('粗');
    }
  });

  it('F5-2 triggerLodGate(空列表) → 黄金向量不变', async () => {
    const { hashPresetFingerprint } = await import('@ai-life-sim/core/engine/rng');
    const s = baseState();
    const fpBefore = hashPresetFingerprint(s._tick, s._lore知识库, undefined, undefined, undefined);
    triggerLodGate(s, [], SEED);
    const fpAfter = hashPresetFingerprint(s._tick, s._lore知识库, undefined, undefined, undefined);
    expect(fpAfter).toBe(fpBefore);
  });

  it('F5-3 newsToCognition(空观察者) → 认知档案不变', () => {
    const s = baseState();
    const before = JSON.stringify(s.认知档案);
    const news: NewsEntry = { 主体: 'nobody', 标签: 'test', 极性: '正', 强度: 50, 维度: '关系', Δ方向: 1, 量级: 60, 来源: 'test' };
    newsToCognition(s, news, [], 0);
    expect(JSON.stringify(s.认知档案)).toBe(before);
  });

  it('F5-4 schemaKeys=53 守恒', async () => {
    const { BLUEPRINT_KEYS } = await import('@ai-life-sim/core');
    expect(BLUEPRINT_KEYS.length).toBe(53);
  });

  it('F5-5 LOD档位 additive 不进指纹（指纹取材集不含 LOD档位）', async () => {
    const { FINGERPRINT_BUNDLE_MEMBERS } = await import('@ai-life-sim/core/engine/fingerprintManifest');
    // LOD档位 是 NPC 内部字段·不在 fingerprintManifest bundle 中
    const members = FINGERPRINT_BUNDLE_MEMBERS.join('|');
    expect(members).not.toContain('LOD档位');
  });
});

// ── F6 · 300 拍 soak（新闻流 + 偶发接触实体化·守恒持续成立）────────────────────

describe('F6 · 300 拍 soak', () => {
  it('F6-1 soak 300 拍·守恒持续成立·seeded 可复现', () => {
    const RUNS = 300;
    const COARSE_SOAK = 'coarse_soak';
    let s = buildWorld();
    // 预置粗节点
    s.NPC[COARSE_SOAK] = NpcSchema.parse({ 姓名: '背景人物', 位置: '' });
    (s.LOD表 as Record<string, unknown>)[COARSE_SOAK] = { 模块键: COARSE_SOAK, 档位: '粗' };

    const news: NewsEntry = {
      主体: COARSE_SOAK,
      标签: '流言',
      极性: '负',
      强度: 55,
      维度: '声誉',
      Δ方向: -1,
      量级: 65,
      来源: 'soak:news',
    };

    for (let tick = 0; tick < RUNS; tick++) {
      s = structuredClone(s);

      // 每 7 拍写一次新闻
      if (tick % 7 === 0) {
        newsToCognition(s, news, [NPC_WANG, NPC_HONG], tick * 100);
      }

      // 第 50 拍触发实体化
      if (tick === 50) {
        triggerLodGate(s, [COARSE_SOAK], SEED);
      }

      // 正常推进 runTick
      const result = runTick(s, {
        tickId: `soak:pr2:${tick}`,
        nowEpochMin: tick * 100,
        seed: SAVE_SEED,
        rerollSalt: 0,
      });
      s = result.state;
    }

    // 守恒断言
    const accounts = Object.entries(s.货币系统.账户);
    assertConservation(
      accounts.map(([k, v]) => ({ key: k, acct: v })),
      EXPECTED_NET_ASSET,
      ({ acct }) => getNetAsset(acct),
    );

    // 粗节点已被实体化（第 50 拍）
    expect(s.LOD表[COARSE_SOAK]?.档位).toBe('实体');

    // 认知档案有新闻写入
    expect(s.认知档案[NPC_WANG]?.[COARSE_SOAK]).toBeDefined();

    // 实体数 = 原始3 + 1粗节点
    expect(Object.keys(s.NPC).length).toBe(4);
  }, 30_000);

  it('F6-2 soak 双跑逐位恒等（seeded 可复现）', () => {
    const RUNS = 50; // 快速双跑
    const COARSE_SOAK2 = 'coarse_soak2';

    function runSoak(): ReturnType<typeof RootSchema.parse> {
      let s = buildWorld();
      s.NPC[COARSE_SOAK2] = NpcSchema.parse({ 姓名: 'BG', 位置: '' });
      (s.LOD表 as Record<string, unknown>)[COARSE_SOAK2] = { 模块键: COARSE_SOAK2, 档位: '粗' };
      const news: NewsEntry = { 主体: COARSE_SOAK2, 标签: '谣言', 极性: '负', 强度: 40, 维度: '关系', Δ方向: -1, 量级: 55, 来源: 'soak2' };
      for (let tick = 0; tick < RUNS; tick++) {
        s = structuredClone(s);
        if (tick % 5 === 0) newsToCognition(s, news, [NPC_WANG], tick * 100);
        if (tick === 20) triggerLodGate(s, [COARSE_SOAK2], SEED);
        const result = runTick(s, { tickId: `soak2:${tick}`, nowEpochMin: tick * 100, seed: SAVE_SEED, rerollSalt: 0 });
        s = result.state;
      }
      return s;
    }

    const s1 = runSoak();
    const s2 = runSoak();
    expect(s1.LOD表[COARSE_SOAK2]?.档位).toBe(s2.LOD表[COARSE_SOAK2]?.档位);
    expect(s1.NPC[COARSE_SOAK2]!.属性.体质).toBe(s2.NPC[COARSE_SOAK2]!.属性.体质);
    expect(JSON.stringify(s1.认知档案[NPC_WANG]?.[COARSE_SOAK2])).toBe(
      JSON.stringify(s2.认知档案[NPC_WANG]?.[COARSE_SOAK2]),
    );
  });
});
