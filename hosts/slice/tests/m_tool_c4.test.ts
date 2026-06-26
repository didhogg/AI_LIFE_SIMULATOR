// commit-4 验收：媒介降为普通 option-set 目标（取代专属媒介通道）
//
// 🧪 DoD 断言：
//   C4-1: 媒介经 option-set 路由落账——mediaTarget+mediaLib → mediaEntry 解引用成功
//   C4-2: 不再走专属通道——媒介解引用经同一 dispatchTool seam，无专属路径分支
//   C4-3: own-property guard——不存在的 mediaTarget → ok=false
//   C4-4: 无 mediaTarget/mediaLib → 不做媒介解引用（向后兼容）
//   C4-5: 媒介与各工具类型组合——code/llm/roll_dice/output_tag 均可携带 mediaEntry
//   C4-6: G0 重定基验证——BUNDLE=21 / manifest=86 不变（媒介路由无新指纹成员）
//   C4-7: 守恒门 schemaKeys=52 / BUNDLE=21 / manifest=86

import { describe, it, expect } from 'vitest';
import { dispatchTool } from '@ai-life-sim/core/engine/toolExecutor';
import { 工具库Schema } from '@ai-life-sim/core/schema/toolLibrary';
import { 媒体库Schema } from '@ai-life-sim/core/schema/mediaLibrary';
import { 选项集库Schema } from '@ai-life-sim/core/schema/optionSetLibrary';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { RootSchema } from '@ai-life-sim/core';

// ── fixture ──────────────────────────────────────────────────────────────────

const TOOL_LIB = 工具库Schema.parse({
  code_tool:   { 名称: 'code tool',   能力: { 类型: 'code' } },
  llm_tool:    { 名称: 'llm tool',    能力: { 类型: 'llm' } },
  trigger_tool:{ 名称: 'trigger',     能力: { 类型: 'trigger' } },
  output_tool: { 名称: 'output',      能力: { 类型: 'output_tag', 输出命名空间: 'media' } },
});

const MEDIA_LIB = 媒体库Schema.parse({
  newspaper_daily: {
    名称: '京城日报',
    媒介类型: '报纸',
    传播系数: 7,
  },
  letter_private: {
    名称: '私信',
    媒介类型: '书信',
    是否传播: false,
  },
});

// ── C4-1: 媒介经 option-set 路由解引用 ──────────────────────────────────────

describe('C4-1 · 媒介经 option-set 路由落账（mediaEntry 解引用）', () => {
  it('code 工具 + mediaTarget=newspaper_daily → mediaEntry=京城日报条目', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'newspaper_daily',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mediaEntry).toBeDefined();
      expect(r.mediaEntry!.名称).toBe('京城日报');
      expect(r.mediaEntry!.媒介类型).toBe('报纸');
    }
  });

  it('mediaEntry 包含完整条目字段（传播系数/媒介类型）', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'newspaper_daily',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mediaEntry?.传播系数).toBe(7);
    }
  });

  it('letter_private 解引用→私信条目', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'letter_private',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mediaEntry?.是否传播).toBe(false);
  });
});

// ── C4-2: 不再走专属通道（同一 dispatchTool seam） ──────────────────────────

describe('C4-2 · 不再走专属通道（同 seam 路由）', () => {
  it('媒介解引用与工具类型无关（code/llm/trigger 均可携带 mediaEntry）', () => {
    const toolNames = ['code_tool', 'llm_tool', 'trigger_tool'];
    for (const toolName of toolNames) {
      const r = dispatchTool({
        toolName,
        toolLib: TOOL_LIB,
        mediaTarget: 'newspaper_daily',
        mediaLib: MEDIA_LIB,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.mediaEntry).toBeDefined();
        expect(r.mediaEntry!.名称).toBe('京城日报');
      }
    }
  });

  it('媒介路由同 seam：dispatchTool 返回类型不变（仍是 ToolDispatchResult）', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'newspaper_daily',
      mediaLib: MEDIA_LIB,
    });
    expect(typeof r.ok).toBe('boolean');
    expect(r).toHaveProperty('ok');
  });
});

// ── C4-3: own-property guard ─────────────────────────────────────────────────

describe('C4-3 · 媒介目标 own-property guard', () => {
  it('不存在的 mediaTarget → ok=false', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'ghost_paper',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('媒体目标');
  });

  it('原型链名 constructor → ok=false（own-property guard）', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'constructor',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(false);
  });
});

// ── C4-4: 无 mediaTarget/mediaLib → 不做媒介解引用 ──────────────────────────

describe('C4-4 · 无媒介参数时不做解引用（向后兼容）', () => {
  it('无 mediaTarget → mediaEntry=undefined', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mediaEntry).toBeUndefined();
  });

  it('有 mediaTarget 无 mediaLib → 不解引用（undefined）', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaTarget: 'newspaper_daily',
      // mediaLib 未传
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mediaEntry).toBeUndefined();
  });

  it('有 mediaLib 无 mediaTarget → mediaEntry=undefined', () => {
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: TOOL_LIB,
      mediaLib: MEDIA_LIB,
      // mediaTarget 未传
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mediaEntry).toBeUndefined();
  });
});

// ── C4-5: 媒介与各工具类型组合 ──────────────────────────────────────────────

describe('C4-5 · 媒介与各工具类型组合', () => {
  it('output_tag + 合法 outputTagPath + mediaTarget → ok=true, mediaEntry 存在', () => {
    const r = dispatchTool({
      toolName: 'output_tool',
      toolLib: TOOL_LIB,
      outputTagPath: 'media.tag',
      mediaTarget: 'newspaper_daily',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe('output_tag');
      expect(r.mediaEntry).toBeDefined();
    }
  });

  it('llm + budgetTokensRemaining=0 → 降级结果 + mediaEntry 仍存在', () => {
    const LIB_WITH_BUDGET = 工具库Schema.parse({
      llm_b: { 名称: 'llm budgeted', 能力: { 类型: 'llm' }, 需预算: true },
    });
    const r = dispatchTool({
      toolName: 'llm_b',
      toolLib: LIB_WITH_BUDGET,
      budgetTokensRemaining: 0,
      mediaTarget: 'newspaper_daily',
      mediaLib: MEDIA_LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.downgraded).toBe(true);
      expect(r.mediaEntry).toBeDefined();
    }
  });
});

// ── C4-6: G0 重定基验证（媒介路由无新指纹成员） ─────────────────────────────

describe('C4-6 · G0 重定基验证', () => {
  it('媒体库不进 hashJudgmentBundle（无新 BUNDLE 成员·BUNDLE 仍=21）', () => {
    // commit-4 additive·媒体库（装配层）不进 hashJudgmentBundle
    // 注：媒体渠道表（G2-2·判定面传播系数）本就在 BUNDLE·不属媒体库条目
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    // 媒体库 schema 新增（commit-4）不会添加新 BUNDLE 成员：库本身属装配层
    const mediaLibBundleMembers = FINGERPRINT_BUNDLE_MEMBERS.filter(
      m => (m as string).includes('媒体库') || (m as string).includes('mediaLibrary'),
    );
    expect(mediaLibBundleMembers.length).toBe(0);
  });

  it('optionSetLibrary schema 可解析（已可导出）', () => {
    // 验证选项集库 schema 可用（commit-4 与 option-set 库同批）
    const lib = 选项集库Schema.parse({
      verb_set_1: {
        名称: '战斗选项集',
        条目: [{ verb: 'attack', target_choices: ['newspaper_daily'] }],
      },
    });
    expect(lib['verb_set_1']?.名称).toBe('战斗选项集');
    expect(lib['verb_set_1']?.条目?.[0]?.target_choices).toContain('newspaper_daily');
  });

  it('媒体库 schema 可解析', () => {
    const lib = 媒体库Schema.parse({
      test_paper: { 名称: '测试报', 媒介类型: '报纸' },
    });
    expect(lib['test_paper']?.名称).toBe('测试报');
  });
});

// ── C4-7: 守恒门 ────────────────────────────────────────────────────────────

describe('C4-7 · 守恒门', () => {
  it('schemaKeys=52', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(52);
  });

  it('BUNDLE=21', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
  });

  it('manifest=86', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(86);
  });
});
