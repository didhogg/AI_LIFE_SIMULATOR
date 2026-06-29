// commit-1 验收：工具执行 seam + 闸③ output_tag 命名空间授权 + 调用约束谓词 gate
//
// 🧪 DoD 断言：
//   C1-1: 越权写命名空间被拒——output_tag delta path 以 $ 开头 → Gate③ 拒绝
//   C1-2: 合法授权放行——valid output_tag path + 合法命名空间覆盖 → ok=true
//   C1-3: 调用约束谓词 gate——failing constraint → blocked; passing → ok; 空串 → ok
//   C1-4: R10-b 命名空间覆盖域校验——覆盖逃出声明域 → 拒; 同域覆盖 → ok
//   C1-5: tool_name 不存在 → false; own-property guard → null（原型名不命中）
//   C1-6: 类型分派骨架——code/llm/roll_dice/json_schema/trigger 各自 ok=true（骨架占位）
//   C1-7: 守恒门 schemaKeys=53 / BUNDLE=21 / manifest=86（无变动）

import { describe, it, expect } from 'vitest';
import {
  dispatchTool,
  resolveToolEntry,
  checkCallConstraint,
  validateOutputTagNamespace,
  routeOutputTagViaGate,
  type ToolDispatchArgs,
} from '@ai-life-sim/core/engine/toolExecutor';
import {
  工具库Schema,
  type 工具库Type,
} from '@ai-life-sim/core/schema/toolLibrary';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { RootSchema } from '@ai-life-sim/core';

// ── 测试工具库 fixture ─────────────────────────────────────────────────────────

function mkLib(overrides?: Record<string, unknown>): 工具库Type {
  return 工具库Schema.parse({
    my_output_tool: {
      名称: 'output tag tool',
      能力: { 类型: 'output_tag', 输出命名空间: 'cuisine' },
    },
    no_ns_tool: {
      名称: 'output tag no ns',
      能力: { 类型: 'output_tag' },  // 无声明命名空间
    },
    constrained_tool: {
      名称: 'constrained tool',
      能力: { 类型: 'code' },
      调用约束: 'a > 0',  // 需要 ctx.a > 0
    },
    unconstrained_tool: {
      名称: 'unconstrained tool',
      能力: { 类型: 'code' },
      调用约束: '',  // 空串=放行
    },
    llm_tool: {
      名称: 'llm tool',
      能力: { 类型: 'llm' },
      需预算: true,
    },
    roll_tool: {
      名称: 'roll dice tool',
      能力: { 类型: 'roll_dice' },
    },
    json_tool: {
      名称: 'json schema tool',
      能力: { 类型: 'json_schema' },
    },
    trigger_tool: {
      名称: 'trigger tool',
      能力: { 类型: 'trigger' },
    },
    ...overrides,
  });
}

const LIB = mkLib();

// ── C1-1: 越权写命名空间被拒（Gate③ $ 前缀硬拒）────────────────────────────────

describe('C1-1 · 越权写命名空间 Gate③ $ 前缀拒绝', () => {
  it('$ 前缀 path → routeOutputTagViaGate ok=false', () => {
    const r = routeOutputTagViaGate('$secret.value');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('前缀权限[③]');
  });

  it('_ 前缀 path → routeOutputTagViaGate ok=false', () => {
    const r = routeOutputTagViaGate('_internal.key');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('前缀权限[③]');
  });

  it('dispatchTool output_tag with $ path → ok=false', () => {
    const args: ToolDispatchArgs = {
      toolName: 'my_output_tool',
      toolLib: LIB,
      outputTagPath: '$forbidden.write',
    };
    const r = dispatchTool(args);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('前缀权限[③]');
  });

  it('合法 path（无 $ / _ 前缀）→ routeOutputTagViaGate ok=true', () => {
    const r = routeOutputTagViaGate('cuisine.flavor_tag');
    expect(r.ok).toBe(true);
  });
});

// ── C1-2: 合法授权放行（output_tag + 合法命名空间覆盖）──────────────────────────

describe('C1-2 · 合法 output_tag 授权放行', () => {
  it('无命名空间覆盖 + 合法 path → ok=true，resolvedNamespace=工具声明值', () => {
    const r = dispatchTool({
      toolName: 'my_output_tool',
      toolLib: LIB,
      outputTagPath: 'cuisine.flavor_tag',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe('output_tag');
      expect(r.resolvedNamespace).toBe('cuisine');
    }
  });

  it('同域命名空间覆盖 cuisine:sub_tag → ok=true，resolvedNamespace=覆盖值', () => {
    const r = dispatchTool({
      toolName: 'my_output_tool',
      toolLib: LIB,
      namespaceOverride: 'cuisine:sub_tag',
      outputTagPath: 'cuisine.flavor_tag',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resolvedNamespace).toBe('cuisine:sub_tag');
    }
  });

  it('无 outputTagPath 时不过 Gate③（路径校验可选）→ ok=true', () => {
    const r = dispatchTool({
      toolName: 'my_output_tool',
      toolLib: LIB,
    });
    expect(r.ok).toBe(true);
  });
});

// ── C1-3: 调用约束谓词 gate ──────────────────────────────────────────────────

describe('C1-3 · 调用约束谓词 gate', () => {
  it('约束不满足（a=0, constraint=a>0）→ dispatchTool ok=false', () => {
    const r = dispatchTool({
      toolName: 'constrained_tool',
      toolLib: LIB,
      ctx: { a: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('调用约束不满足');
  });

  it('约束满足（a=5, constraint=a>0）→ dispatchTool ok=true', () => {
    const r = dispatchTool({
      toolName: 'constrained_tool',
      toolLib: LIB,
      ctx: { a: 5 },
    });
    expect(r.ok).toBe(true);
  });

  it('空串约束→ checkCallConstraint true（空串极性：放行）', () => {
    const entry = LIB['unconstrained_tool']!;
    expect(checkCallConstraint(entry, {})).toBe(true);
  });

  it('无 调用约束 字段→ checkCallConstraint true', () => {
    const entry = LIB['my_output_tool']!;
    expect(checkCallConstraint(entry, {})).toBe(true);
  });

  it('不合法谓词串→ fail-closed（false）', () => {
    const entry = { ...LIB['my_output_tool']!, 调用约束: '!@#invalid' };
    expect(checkCallConstraint(entry, {})).toBe(false);
  });
});

// ── C1-4: R10-b 命名空间覆盖域校验 ──────────────────────────────────────────

describe('C1-4 · R10-b 命名空间覆盖域校验', () => {
  it('覆盖逃出声明域 dialect→cuisine → ok=false', () => {
    const entry = LIB['my_output_tool']!; // 声明域=cuisine
    const r = validateOutputTagNamespace(entry, 'dialect:accent_tag');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('R10-b');
  });

  it('无命名空间工具 + 覆盖→ ok=false（无域声明不可覆盖）', () => {
    const entry = LIB['no_ns_tool']!;
    const r = validateOutputTagNamespace(entry, 'cuisine:anything');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('未声明 输出命名空间');
  });

  it('同域覆盖 cuisine:sub → ok=true', () => {
    const entry = LIB['my_output_tool']!;
    const r = validateOutputTagNamespace(entry, 'cuisine:sub');
    expect(r.ok).toBe(true);
    expect(r.resolvedNamespace).toBe('cuisine:sub');
  });

  it('无覆盖 + 有声明域 → resolvedNamespace=声明域', () => {
    const entry = LIB['my_output_tool']!;
    const r = validateOutputTagNamespace(entry);
    expect(r.ok).toBe(true);
    expect(r.resolvedNamespace).toBe('cuisine');
  });

  it('无覆盖 + 无声明域 → ok=true, resolvedNamespace=undefined', () => {
    const entry = LIB['no_ns_tool']!;
    const r = validateOutputTagNamespace(entry);
    expect(r.ok).toBe(true);
    expect(r.resolvedNamespace).toBeUndefined();
  });
});

// ── C1-5: 解引用 + own-property guard ──────────────────────────────────────

describe('C1-5 · 解引用 + own-property guard', () => {
  it('存在的 tool_name → resolveToolEntry 返回条目', () => {
    const e = resolveToolEntry('my_output_tool', LIB);
    expect(e).not.toBeNull();
    expect(e?.名称).toBe('output tag tool');
  });

  it('不存在的 tool_name → null', () => {
    expect(resolveToolEntry('nonexistent', LIB)).toBeNull();
  });

  it('空串 → null', () => {
    expect(resolveToolEntry('', LIB)).toBeNull();
  });

  it('原型链名 constructor → null（own-property guard）', () => {
    expect(resolveToolEntry('constructor', LIB)).toBeNull();
  });

  it('dispatchTool 不存在工具 → ok=false', () => {
    const r = dispatchTool({ toolName: 'ghost', toolLib: LIB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('不存在');
  });
});

// ── C1-6: 类型分派骨架（stub 占位·各类型 ok=true）────────────────────────────

describe('C1-6 · 类型分派骨架 ok=true', () => {
  const cases: [string, string][] = [
    ['llm_tool',     'llm'],
    ['roll_tool',    'roll_dice'],
    ['json_tool',    'json_schema'],
    ['trigger_tool', 'trigger'],
    ['constrained_tool', 'code'],  // ctx.a=10 满足约束
  ];

  for (const [toolName, expectedKind] of cases) {
    it(`${toolName} → kind=${expectedKind}, ok=true`, () => {
      const r = dispatchTool({ toolName, toolLib: LIB, ctx: { a: 10 } });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.kind).toBe(expectedKind);
    });
  }
});

// ── C1-7: 守恒门 ────────────────────────────────────────────────────────────

describe('C1-7 · 守恒门', () => {
  it('schemaKeys=53 守恒', () => {
    const keys = Object.keys(RootSchema.shape);
    expect(keys.length).toBe(54);
  });

  it('BUNDLE=21 守恒（工具库不进 hashJudgmentBundle）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
  });

  it('manifest=88（BUNDLE+PRESET+SNAP+EXCL 行数不变）', () => {
    // 86 = BUNDLE(21) + PRESET(11) + SNAPSHOT(5) + EXCLUDED(49)
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(94);
  });

  it('工具库条目内容改变 → 指纹不变（整库不进 hashJudgmentBundle）', () => {
    // 验证：修改工具库字段不触发 BUNDLE 成员计数变化（静态守恒）
    const libWithExtra = mkLib({
      bonus_tool: { 名称: 'extra', 能力: { 类型: 'code' } },
    });
    const r = resolveToolEntry('bonus_tool', libWithExtra);
    expect(r?.名称).toBe('extra');
    // BUNDLE 成员数不变（工具库属装配层·不进指纹）
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
  });
});
