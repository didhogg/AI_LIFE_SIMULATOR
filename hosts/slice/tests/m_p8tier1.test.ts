// P0-8 Batch 1: 组装器骨架 + 纵切止血验证
// ① CALL_TYPE_REGISTRY 五种类型全具名·无裸 prompt 串
// ② assemblePrompt 近 K 拍叙事历史注入（K=3·传5·末3注入·前2截断）
// ③ assemblePrompt 近 K 拍动作序列注入
// ④ assemblePrompt lore 底层谓词切片（R7-b·匹配→注入知识载荷·不匹配→不注入）
// ⑤ assemblePrompt NPC 记忆字段注入（重要度≥2 最近3条·组装侧只读）
// ⑥ assemblePrompt NPC 情绪栈注入（顶层2条·只读）
// ⑦ assemblePrompt 编年史注入（表层公共·最近5条）
// ⑧ assemblePrompt 知情过滤前置闸（povEntityKey→内部过滤·真值泄漏fixture不过）
// ⑨ assemblePrompt live 账本注入（balances 参数路径）
// ⑩ 切片确定性律：assemblePrompt 输出与 fingerprintManifest 完全正交（不进指纹）
// ⑪ 双机一致性（同入参→同 systemPrompt）
// ⑫ POV 认知投影注入（他以为·只取本 POV·跳过自我条目）

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  CALL_TYPE_REGISTRY,
  NARRATIVE_CALL_TYPES,
  DEFAULT_NEAR_K,
  getCallTypeSpec,
  type CallTypeSpec,
} from '@ai-life-sim/core/prompt/callRegistry';
import { FINGERPRINT_BUNDLE_MEMBERS } from '@ai-life-sim/core/engine/fingerprintManifest';
import { assemblePrompt } from '../assemble.js';
import {
  buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME,
} from '../fixture/world.js';

// ── fixtures ─────────────────────────────────────────────────────────────────
const BASE_STATE = buildWorld();

function makeStateWithLore(predicate: string, 知识载荷: string) {
  return {
    ...BASE_STATE,
    _lore知识库: {
      'test:lore_entry': {
        分类路径: [],
        别名表: [],
        触发谓词: predicate,
        知识载荷,
        触发谓词_冻结: false,
      },
    },
  } as unknown as ReturnType<typeof buildWorld>;
}

function makeStateWithNPCMemory() {
  const state = RootSchema.parse({
    ...BASE_STATE,
    NPC: {
      ...BASE_STATE.NPC,
      [NPC_WANG]: {
        ...BASE_STATE.NPC?.[NPC_WANG],
        记忆: [
          { 记忆id: 'm1', 摘要: '林九赊账了三次', 重要度: 2, 情绪色彩: '不满', 权重: 60, 发生时间: 0, 类型: '互动', 永久: false, 上次唤起时间: 0 },
          { 记忆id: 'm2', 摘要: '红姨偷偷帮林九说情', 重要度: 3, 情绪色彩: '惊讶', 权重: 80, 发生时间: 0, 类型: '互动', 永久: false, 上次唤起时间: 0 },
          { 记忆id: 'm3', 摘要: '林九给了一点小费', 重要度: 1, 情绪色彩: '淡然', 权重: 30, 发生时间: 0, 类型: '互动', 永久: false, 上次唤起时间: 0 },
        ],
        情绪栈: [
          { 情绪名: '警惕', 强度: 60, 触发条件: '', 衰减速率: 0 },
          { 情绪名: '好奇', 强度: 40, 触发条件: '', 衰减速率: 0 },
        ],
      },
    },
  });
  return state;
}

function makeStateWithChronicle() {
  const globalWithChronicle = {
    ...(BASE_STATE.全局 ?? {}),
    _编年史: [
      { 序号: 1, 时间: 100, 标题: '林九初抵客栈', 结果摘要行: '林九踏入悦来客栈', 关联实体键: ['pc_linjiu'], 重要等级: '重要' },
      { 序号: 2, 时间: 200, 标题: '王掌柜出来招待', 结果摘要行: '王掌柜端来茶水', 关联实体键: ['npc_wang'], 重要等级: '次要' },
    ],
  };
  return RootSchema.parse({ ...BASE_STATE, 全局: globalWithChronicle });
}

function makeStateWithCogArchive() {
  // 主角对王掌柜有认知档案：认为他很吝啬
  const cogData = {
    [PC]: {
      [NPC_WANG]: {
        了解度: 60,
        误差表: {},
        印象: [
          { 标签: '吝啬', 极性: '负', 强度: 70, 来源: '直接观察', 获知时间: 0, 衰减速率: 0 },
          { 标签: '勤劳', 极性: '正', 强度: 50, 来源: '耳闻', 获知时间: 0, 衰减速率: 0 },
        ],
        时效: 0,
        姓名知识: '已知姓名' as const,
      },
    },
  };
  return RootSchema.parse({ ...BASE_STATE, 认知档案: cogData });
}

// ── ① 调用类型注册表结构完整 ─────────────────────────────────────────────────────
describe('P0-8 ① CALL_TYPE_REGISTRY 完整性', () => {
  it('五种类型全部在注册表中', () => {
    for (const key of Object.values(NARRATIVE_CALL_TYPES)) {
      expect(CALL_TYPE_REGISTRY).toHaveProperty(key);
    }
  });

  it('每条记录都有上下文组装器/输出schema/温度/模型档位/超时重试策略', () => {
    for (const [, spec] of Object.entries(CALL_TYPE_REGISTRY) as [string, CallTypeSpec][]) {
      expect(spec.上下文组装器).toBeTruthy();
      expect(spec.输出schema).toBeTruthy();
      expect(typeof spec.温度).toBe('number');
      expect(spec.模型档位).toBeTruthy();
      expect(spec.超时重试策略).toBeTruthy();
    }
  });

  it('切片预算截断优先级为非空数组', () => {
    for (const [, spec] of Object.entries(CALL_TYPE_REGISTRY) as [string, CallTypeSpec][]) {
      expect(Array.isArray(spec.切片预算.截断优先级)).toBe(true);
      expect(spec.切片预算.截断优先级.length).toBeGreaterThan(0);
    }
  });

  it('DEFAULT_NEAR_K=6', () => {
    expect(DEFAULT_NEAR_K).toBe(6);
  });

  it('getCallTypeSpec 返回正确规格', () => {
    const spec = getCallTypeSpec('开场白叙事');
    expect(spec.上下文组装器).toBe('assembler_开场白');
    expect(spec.副作用级别).toBe('none');
  });
});

// ── ② 近 K 拍叙事历史注入 ──────────────────────────────────────────────────────
describe('P0-8 ② 近 K 拍叙事历史注入', () => {
  it('nearK=3·传5条·userPrompt 含末3条', () => {
    const history = ['叙事1', '叙事2', '叙事3', '叙事4', '叙事5'];
    const { userPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME, narrativeHistory: history, nearK: 3,
    });
    expect(userPrompt).toContain('叙事3');
    expect(userPrompt).toContain('叙事4');
    expect(userPrompt).toContain('叙事5');
    expect(userPrompt).not.toContain('叙事1');
    expect(userPrompt).not.toContain('叙事2');
  });

  it('nearK 不传时使用 DEFAULT_NEAR_K', () => {
    const history = Array.from({ length: DEFAULT_NEAR_K + 2 }, (_, i) => `叙事${i + 1}`);
    const { userPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME, narrativeHistory: history,
    });
    // 末 DEFAULT_NEAR_K 条在 prompt 中
    expect(userPrompt).toContain(`叙事${history.length}`);
    expect(userPrompt).toContain(`叙事${history.length - DEFAULT_NEAR_K + 1}`);
    // 超出 K 的不在 prompt
    expect(userPrompt).not.toContain('叙事1');
  });

  it('无历史时 userPrompt 不含「近期叙事」节', () => {
    const { userPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME,
    });
    expect(userPrompt).not.toContain('【近期叙事】');
  });
});

// ── ③ 动作序列注入 ───────────────────────────────────────────────────────────
describe('P0-8 ③ 动作序列注入', () => {
  it('actionHistory 注入到 userPrompt', () => {
    const { userPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME,
      actionHistory: ['给钱', '赊账', '对话'],
    });
    expect(userPrompt).toContain('给钱 → 赊账 → 对话');
  });

  it('超过6条只取末6条', () => {
    const actions = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    const { userPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME, actionHistory: actions,
    });
    expect(userPrompt).toContain('a2 → a3 → a4 → a5 → a6 → a7');
    expect(userPrompt).not.toContain('a1 →');
  });
});

// ── ④ lore 底层谓词切片（R7-b）────────────────────────────────────────────────
describe('P0-8 ④ lore 底层谓词切片', () => {
  it('谓词命中时：知识载荷出现在 systemPrompt（叙事注入路径）', () => {
    // PC 体质=5，谓词 "属性.体质 > 3" → true
    const state = makeStateWithLore('属性.体质 > 3', '汉服交领右衽是正统礼仪');
    const lorePredCtx = { 属性: { 体质: 5 } };
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, lorePredCtx,
    });
    expect(systemPrompt).toContain('汉服交领右衽是正统礼仪');
    expect(systemPrompt).toContain('世界常识（lore）');
  });

  it('谓词不命中时：知识载荷不注入', () => {
    // 谓词 "属性.体质 > 100" → false (PC 体质=5)
    const state = makeStateWithLore('属性.体质 > 100', '这条不应出现');
    const lorePredCtx = { 属性: { 体质: 5 } };
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, lorePredCtx,
    });
    expect(systemPrompt).not.toContain('这条不应出现');
  });

  it('无 lorePredCtx 时：lore 节不出现', () => {
    const state = makeStateWithLore('属性.体质 > 0', '不应出现的 lore');
    const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).not.toContain('世界常识（lore）');
    expect(systemPrompt).not.toContain('不应出现的 lore');
  });

  it('无谓词时（空串）：知识载荷恒注入', () => {
    const state = makeStateWithLore('', '无谓词的通用常识');
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, lorePredCtx: {},
    });
    expect(systemPrompt).toContain('无谓词的通用常识');
  });
});

// ── ⑤ NPC 记忆字段注入 ─────────────────────────────────────────────────────
describe('P0-8 ⑤ NPC 记忆注入（组装侧只读）', () => {
  it('重要度≥2 的记忆摘要出现在 systemPrompt', () => {
    const state = makeStateWithNPCMemory();
    const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).toContain('林九赊账了三次');
    expect(systemPrompt).toContain('红姨偷偷帮林九说情');
  });

  it('重要度<2 的记忆不注入', () => {
    const state = makeStateWithNPCMemory();
    const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).not.toContain('林九给了一点小费');
  });

  it('情绪色彩随记忆一起注入', () => {
    const state = makeStateWithNPCMemory();
    const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).toContain('不满');
  });
});

// ── ⑥ NPC 情绪栈注入 ─────────────────────────────────────────────────────
describe('P0-8 ⑥ NPC 情绪栈注入', () => {
  it('情绪名出现在 systemPrompt', () => {
    const state = makeStateWithNPCMemory();
    const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).toContain('情绪: 警惕');
    expect(systemPrompt).toContain('情绪: 好奇');
  });
});

// ── ⑦ 编年史注入 ─────────────────────────────────────────────────────────
describe('P0-8 ⑦ 编年史注入（表层公共）', () => {
  it('编年史条目标题和摘要出现在 systemPrompt', () => {
    const state = makeStateWithChronicle();
    const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).toContain('近期编年史');
    expect(systemPrompt).toContain('林九初抵客栈');
    expect(systemPrompt).toContain('王掌柜出来招待');
  });

  it('无编年史时不插入编年史节', () => {
    const { systemPrompt } = assemblePrompt(BASE_STATE, { pcKey: PC, locName: LOC_NAME });
    expect(systemPrompt).not.toContain('## 近期编年史');
  });
});

// ── ⑧ 知情过滤前置闸（povEntityKey 路径）───────────────────────────────────────
describe('P0-8 ⑧ 知情过滤前置闸', () => {
  it('PC POV → 无法看到 S1（PC 不在知情名单）', () => {
    const { systemPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
    });
    expect(systemPrompt).not.toContain('## 当前已知秘密');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
    expect(systemPrompt).not.toContain('S1');
  });

  it('WANG POV → 可看到 S1（王掌柜在知情名单）', () => {
    const { systemPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: NPC_WANG, locName: LOC_NAME, povEntityKey: NPC_WANG,
    });
    expect(systemPrompt).toContain('当前已知秘密');
    expect(systemPrompt).toContain('窝藏通缉旧友');
  });

  it('HONG POV → 无法看到 S1（红姨不在知情名单）', () => {
    const { systemPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: NPC_HONG, locName: LOC_NAME, povEntityKey: NPC_HONG,
    });
    expect(systemPrompt).not.toContain('## 当前已知秘密');
    expect(systemPrompt).not.toContain('窝藏通缉旧友');
  });

  it('povEntityKey 优先于 visibleSecrets（gate 不可旁路）', () => {
    // 传入假 visibleSecrets（含 S1），但 povEntityKey=PC → assembler 内部重过滤
    const fakeVisible = {
      S1: { 母题: '恶意注入', 严重度: 100, 暴露度: 100 },
    };
    const { systemPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME,
      povEntityKey: PC,
      visibleSecrets: fakeVisible,
    });
    // PC 不在知情名单 → 内部过滤抹除假注入
    expect(systemPrompt).not.toContain('恶意注入');
    expect(systemPrompt).not.toContain('## 当前已知秘密');
  });
});

// ── ⑨ live 账本注入 ────────────────────────────────────────────────────────
describe('P0-8 ⑨ live 账本注入', () => {
  it('balances 参数路径：账本余额出现在 userPrompt', () => {
    const { userPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME,
      balances: { [PC]: 42, [NPC_WANG]: 180 },
    });
    expect(userPrompt).toContain('【账目】');
    expect(userPrompt).toContain('42');
    expect(userPrompt).toContain('180');
  });

  it('无 balances 时不插入账目节', () => {
    const { userPrompt } = assemblePrompt(BASE_STATE, { pcKey: PC, locName: LOC_NAME });
    expect(userPrompt).not.toContain('【账目】');
  });
});

// ── ⑩ 切片不进指纹（确定性律）───────────────────────────────────────────────
describe('P0-8 ⑩ 切片不进指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含 assemblePrompt/narrative 字样', () => {
    const members = FINGERPRINT_BUNDLE_MEMBERS.map((m) => m.toLowerCase());
    for (const m of members) {
      expect(m).not.toContain('assemble');
      expect(m).not.toContain('narrative_slice');
      expect(m).not.toContain('prompt_output');
    }
  });

  it('assemblePrompt 是纯函数（同入参→同输出·不改 state）', () => {
    const before = JSON.stringify(BASE_STATE);
    assemblePrompt(BASE_STATE, { pcKey: PC, locName: LOC_NAME });
    const after = JSON.stringify(BASE_STATE);
    expect(after).toBe(before);
  });
});

// ── ⑪ 双机一致性 ─────────────────────────────────────────────────────────
describe('P0-8 ⑪ 双机一致性', () => {
  it('同入参→同 systemPrompt（assemblePrompt 纯函数）', () => {
    const opts = {
      pcKey: PC, locName: LOC_NAME,
      narrativeHistory: ['叙事A', '叙事B'],
      actionHistory: ['给钱'],
      nearK: 2,
    };
    const { systemPrompt: s1 } = assemblePrompt(BASE_STATE, opts);
    const { systemPrompt: s2 } = assemblePrompt(BASE_STATE, opts);
    expect(s1).toBe(s2);
  });

  it('同入参→同 userPrompt', () => {
    const opts = {
      pcKey: PC, locName: LOC_NAME,
      balances: { [PC]: 25 },
      narrativeHistory: ['第一幕', '第二幕'],
    };
    const { userPrompt: u1 } = assemblePrompt(BASE_STATE, opts);
    const { userPrompt: u2 } = assemblePrompt(BASE_STATE, opts);
    expect(u1).toBe(u2);
  });
});

// ── ⑫ POV 认知投影（他以为）───────────────────────────────────────────────
describe('P0-8 ⑫ POV 认知投影注入', () => {
  it('PC 对 NPC_WANG 的印象出现在 systemPrompt（他以为标签）', () => {
    const state = makeStateWithCogArchive();
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
    });
    expect(systemPrompt).toContain('主角认知投影（他以为）');
    expect(systemPrompt).toContain(`他以为 ${NPC_WANG}`);
    expect(systemPrompt).toContain('吝啬');
  });

  it('自我认知条目跳过（不出现「他以为 pc_linjiu」）', () => {
    const state = makeStateWithCogArchive();
    const { systemPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
    });
    expect(systemPrompt).not.toContain(`他以为 ${PC}`);
  });

  it('无认知档案时不插入投影节', () => {
    const { systemPrompt } = assemblePrompt(BASE_STATE, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
    });
    expect(systemPrompt).not.toContain('主角认知投影（他以为）');
  });
});
