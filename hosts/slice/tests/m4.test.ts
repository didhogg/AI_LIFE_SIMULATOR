// M4 知情过滤最小版 + 一个秘密(S1)不泄露
// ① filterSecretsForPOV 单元：知情方 / 非知情方 / 混合 / 空库
// ② entityKnowsSecret 单元
// ③ assemblePrompt + visibleSecrets 注入（知情方可见·existence-opaque 验证）
// ④ S1 existence-opaque：主角侧输出零 S1 痕迹、王掌柜内部仍有 S1
// ⑤ $谜底 永不输出（即使知情方也不泄露谜底字段）
// ⑥ 拍8 "林九试探客栈后院"剧本 → 主角 POV prompt 中无 S1 痕迹；其余拍不回归
// ⑦ filterSecretsForPOV = 唯一实现（不得另起实现·此测试为唯一正典入口）
import { describe, it, expect } from 'vitest';
import {
  filterSecretsForPOV,
  entityKnowsSecret,
} from '@ai-life-sim/core/engine/knowledgeFilter';
import type { VisibleSecret } from '@ai-life-sim/core/engine/knowledgeFilter';
import type { 秘密库条目Type } from '@ai-life-sim/core';
import { assemblePrompt }   from '../assemble.js';
import { buildWorld, PC, NPC_WANG, NPC_HONG, SECRET_S1 } from '../fixture/world.js';

// ── 测试夹具：秘密库 ────────────────────────────────────────────────────────────
function makeSecret(knowers: string[]): 秘密库条目Type {
  return {
    母题:   '藏匿通缉犯',
    $谜底:  '王掌柜在后院私藏了一名被官府通缉的旧友。',
    严重度: 80,
    暴露度: 0,
    进展:   0,
    涉事方: [],
    已暴露线索: [],
    知情名单: knowers.map(k => ({
      对象: k, 知情程度: 100, 立场: '', 掩护基调: '',
    })),
  };
}

const ONLY_WANG: Record<string, 秘密库条目Type> = {
  [SECRET_S1]: makeSecret([NPC_WANG]),
};

// ── ① filterSecretsForPOV 单元 ────────────────────────────────────────────────
describe('M4 ① filterSecretsForPOV 单元', () => {
  it('知情方（王掌柜）→ 返回 VisibleSecret 条目', () => {
    const result = filterSecretsForPOV(ONLY_WANG, NPC_WANG);
    expect(Object.keys(result)).toHaveLength(1);
    const s = result[SECRET_S1] as VisibleSecret | undefined;
    expect(s).toBeDefined();
    expect(s?.母题).toBe('藏匿通缉犯');
    expect(s?.严重度).toBe(80);
    expect(s?.暴露度).toBe(0);
  });

  it('非知情方（主角 林九）→ 返回空对象（existence-opaque）', () => {
    const result = filterSecretsForPOV(ONLY_WANG, PC);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('非知情方（红姨）→ 返回空对象（existence-opaque）', () => {
    const result = filterSecretsForPOV(ONLY_WANG, NPC_HONG);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('空秘密库 → 返回空对象', () => {
    const result = filterSecretsForPOV({}, NPC_WANG);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('混合知情：S1(王) + S2(林九) → 各自只见自己知道的', () => {
    const mixed: Record<string, 秘密库条目Type> = {
      S1: makeSecret([NPC_WANG]),
      S2: makeSecret([PC]),
    };
    const wangSees  = filterSecretsForPOV(mixed, NPC_WANG);
    const linjuSees = filterSecretsForPOV(mixed, PC);
    expect(Object.keys(wangSees)).toEqual(['S1']);
    expect(Object.keys(linjuSees)).toEqual(['S2']);
  });

  it('多人共知同一秘密 → 各知情方均可见', () => {
    const shared: Record<string, 秘密库条目Type> = {
      S1: makeSecret([NPC_WANG, PC]),
    };
    expect(Object.keys(filterSecretsForPOV(shared, NPC_WANG))).toHaveLength(1);
    expect(Object.keys(filterSecretsForPOV(shared, PC))).toHaveLength(1);
    expect(Object.keys(filterSecretsForPOV(shared, NPC_HONG))).toHaveLength(0);
  });

  it('未命中任何实体键 → 返回空对象', () => {
    const result = filterSecretsForPOV(ONLY_WANG, 'npc_stranger');
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ── ② entityKnowsSecret 单元 ─────────────────────────────────────────────────
describe('M4 ② entityKnowsSecret 单元', () => {
  const s1 = makeSecret([NPC_WANG]);

  it('知情方 → true', () => {
    expect(entityKnowsSecret(s1, NPC_WANG)).toBe(true);
  });

  it('非知情方 → false', () => {
    expect(entityKnowsSecret(s1, PC)).toBe(false);
    expect(entityKnowsSecret(s1, NPC_HONG)).toBe(false);
  });

  it('空知情名单 → false', () => {
    const empty = makeSecret([]);
    expect(entityKnowsSecret(empty, NPC_WANG)).toBe(false);
  });
});

// ── ③ assemblePrompt + visibleSecrets 注入 ────────────────────────────────────
describe('M4 ③ assemblePrompt + visibleSecrets 注入', () => {
  const state = buildWorld();

  it('王掌柜 POV → prompt 含秘密节', () => {
    const visible = filterSecretsForPOV(
      (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>,
      NPC_WANG,
    );
    const { systemPrompt } = assemblePrompt(state, {
      pcKey:          NPC_WANG,
      locName:        '悦来客栈',
      visibleSecrets: visible,
    });
    expect(systemPrompt).toContain('当前已知秘密');
    expect(systemPrompt).toContain('窝藏通缉旧友');
  });

  it('王掌柜 POV → prompt 含严重度/暴露度', () => {
    const visible = filterSecretsForPOV(
      (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>,
      NPC_WANG,
    );
    const { systemPrompt } = assemblePrompt(state, {
      pcKey:          NPC_WANG,
      locName:        '悦来客栈',
      visibleSecrets: visible,
    });
    expect(systemPrompt).toContain('严重度70');
    expect(systemPrompt).toContain('暴露度0');
  });

  it('visibleSecrets 为空对象 → prompt 中无秘密节（existence-opaque）', () => {
    const { systemPrompt } = assemblePrompt(state, {
      pcKey:          PC,
      locName:        '悦来客栈',
      visibleSecrets: {},
    });
    // existence-opaque：S1 特有内容不得出现；一般汉字"秘密"可能出现在系统指令中故不检
    expect(systemPrompt).not.toContain('## 当前已知秘密');
    expect(systemPrompt).not.toContain('S1');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
  });

  it('visibleSecrets 省略 → prompt 中无秘密节（existence-opaque）', () => {
    const { systemPrompt } = assemblePrompt(state, {
      pcKey:   PC,
      locName: '悦来客栈',
    });
    expect(systemPrompt).not.toContain('## 当前已知秘密');
    expect(systemPrompt).not.toContain('S1');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
  });
});

// ── ④ S1 existence-opaque ─────────────────────────────────────────────────────
describe('M4 ④ S1 existence-opaque（主角/红姨 POV）', () => {
  const state = buildWorld();
  const secrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;

  it('主角 POV filterSecretsForPOV → 无 S1 条目', () => {
    const visible = filterSecretsForPOV(secrets, PC);
    expect(visible[SECRET_S1]).toBeUndefined();
    expect(Object.keys(visible)).toHaveLength(0);
  });

  it('红姨 POV filterSecretsForPOV → 无 S1 条目', () => {
    const visible = filterSecretsForPOV(secrets, NPC_HONG);
    expect(visible[SECRET_S1]).toBeUndefined();
  });

  it('主角 POV prompt → 零 S1 痕迹（连 S1 键都不出现）', () => {
    const visible = filterSecretsForPOV(secrets, PC);
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: '悦来客栈', visibleSecrets: visible,
    });
    expect(systemPrompt).not.toContain('S1');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
    expect(systemPrompt).not.toContain('## 当前已知秘密');
    expect(systemPrompt).not.toContain('通缉的旧友');
  });

  it('王掌柜内部状态仍有 S1（引擎原始 state 不被过滤修改）', () => {
    const rawSecrets = state.全局?.秘密库;
    expect(rawSecrets).toBeDefined();
    expect(rawSecrets?.[SECRET_S1]).toBeDefined();
    expect(rawSecrets?.[SECRET_S1]?.母题).toBe('窝藏通缉旧友');
    expect(rawSecrets?.[SECRET_S1]?.知情名单).toHaveLength(1);
    expect(rawSecrets?.[SECRET_S1]?.知情名单[0]?.对象).toBe(NPC_WANG);
  });

  it('filterSecretsForPOV 是纯函数：不修改原始 secrets 对象', () => {
    const originalKeys = Object.keys(secrets);
    filterSecretsForPOV(secrets, PC);
    expect(Object.keys(secrets)).toEqual(originalKeys);
  });
});

// ── ⑤ $谜底 永不输出 ─────────────────────────────────────────────────────────
describe('M4 ⑤ $谜底 永不输出', () => {
  const state = buildWorld();
  const secrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;

  it('知情方（王掌柜）VisibleSecret 中无 $谜底 字段', () => {
    const visible = filterSecretsForPOV(secrets, NPC_WANG);
    const s1vis = visible[SECRET_S1];
    expect(s1vis).toBeDefined();
    // $谜底 不在 VisibleSecret 类型里，运行时也不应存在
    expect((s1vis as Record<string, unknown>)['$谜底']).toBeUndefined();
    expect((s1vis as Record<string, unknown>)['谜底']).toBeUndefined();
  });

  it('知情方 prompt 中无谜底内容（通缉旧友细节）', () => {
    const visible = filterSecretsForPOV(secrets, NPC_WANG);
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: NPC_WANG, locName: '悦来客栈', visibleSecrets: visible,
    });
    expect(systemPrompt).not.toContain('后院');
    expect(systemPrompt).not.toContain('通缉的旧友');
  });
});

// ── ⑥ 拍8 "林九试探客栈后院"剧本 ─────────────────────────────────────────────
describe('M4 ⑥ 拍8 林九试探客栈后院', () => {
  // 基于 world fixture，模拟拍8场景：林九视角，试探后院时的 prompt 组装
  const state = buildWorld();
  const secrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;

  it('拍8 林九 POV → systemPrompt 无 S1 痕迹', () => {
    const pcVisible = filterSecretsForPOV(secrets, PC);
    const { systemPrompt } = assemblePrompt(state, {
      pcKey:          PC,
      locName:        '悦来客栈后院',
      visibleSecrets: pcVisible,
      historyTicks:   ['拍7：林九在大堂饮茶。'],
    });
    // 主角视角：S1 的存在性必须完全隐形
    expect(systemPrompt).not.toContain('S1');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
    expect(systemPrompt).not.toContain('通缉的旧友');    // $谜底内容
    expect(systemPrompt).not.toContain('## 当前已知秘密'); // 秘密节头
  });

  it('拍8 王掌柜内部状态 → 秘密库完整保留 S1', () => {
    // 引擎状态不被过滤函数污染
    expect(secrets[SECRET_S1]?.母题).toBe('窝藏通缉旧友');
    expect(secrets[SECRET_S1]?.知情名单.length).toBeGreaterThan(0);
    expect(secrets[SECRET_S1]?.知情名单.some(e => e.对象 === NPC_WANG)).toBe(true);
  });

  it('拍8 红姨 POV → systemPrompt 也无 S1 痕迹', () => {
    const hongVisible = filterSecretsForPOV(secrets, NPC_HONG);
    expect(Object.keys(hongVisible)).toHaveLength(0);
    const { systemPrompt } = assemblePrompt(state, {
      pcKey:          NPC_HONG,
      locName:        '悦来客栈',
      visibleSecrets: hongVisible,
    });
    expect(systemPrompt).not.toContain('## 当前已知秘密');
    expect(systemPrompt).not.toContain('S1');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
  });

  it('拍8 过滤不改变原 state（其余拍不回归）', () => {
    const before = JSON.stringify(state.全局?.秘密库);
    filterSecretsForPOV(secrets, PC);
    filterSecretsForPOV(secrets, NPC_HONG);
    const after = JSON.stringify(state.全局?.秘密库);
    expect(after).toBe(before);
  });
});

// ── ⑦ 唯一实现验证 ───────────────────────────────────────────────────────────
describe('M4 ⑦ filterSecretsForPOV 唯一正典入口', () => {
  it('filterSecretsForPOV 是函数（唯一正典实现·禁第二实现）', () => {
    expect(typeof filterSecretsForPOV).toBe('function');
  });

  it('entityKnowsSecret 是函数（唯一正典辅助·禁第二实现）', () => {
    expect(typeof entityKnowsSecret).toBe('function');
  });

  it('VisibleSecret 不含 $谜底（TypeScript 层封印·运行时双重验证）', () => {
    const s1 = makeSecret([NPC_WANG]);
    const result = filterSecretsForPOV({ S1: s1 }, NPC_WANG);
    const keys = Object.keys(result['S1'] ?? {});
    expect(keys).toContain('母题');
    expect(keys).toContain('严重度');
    expect(keys).toContain('暴露度');
    expect(keys).not.toContain('$谜底');
    expect(keys).not.toContain('谜底');
    expect(keys).not.toContain('知情名单');
    expect(keys).not.toContain('涉事方');
  });
});
