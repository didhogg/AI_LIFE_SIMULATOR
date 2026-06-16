// B-NSFW: NSFW 内容隔离验证
// 验证: NSFW_BASELINE / availableContentRatings / DEFAULT_NSFW_CONTENT 结构正确
//        + 指定模块之外无 NSFW 内容串散落（防回归 CI 门）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NSFW_BASELINE,
  CONTENT_RATING_SUBSETS,
  DEFAULT_NSFW_CONTENT,
  availableContentRatings,
} from '../engine/nsfwContent.js';

const CORE_ROOT = join(fileURLToPath(import.meta.url), '..', '..'); // packages/core/

// ── NSFW_BASELINE 基准线常量 ─────────────────────────────────────────────────

describe('B-NSFW · NSFW_BASELINE', () => {
  it('P0 基准线 = full（四档全开）', () => {
    expect(NSFW_BASELINE).toBe('full');
  });

  it('NSFW_BASELINE 类型为合法值（sfw|light|full）', () => {
    expect(['sfw', 'light', 'full']).toContain(NSFW_BASELINE);
  });
});

// ── availableContentRatings 档位子集 ─────────────────────────────────────────

describe('B-NSFW · availableContentRatings', () => {
  it('full 基准线 → 四档全开', () => {
    expect(availableContentRatings()).toEqual(['off', 'light', 'explicit', 'community']);
  });

  it('CONTENT_RATING_SUBSETS.sfw = [off]', () => {
    expect(CONTENT_RATING_SUBSETS.sfw).toEqual(['off']);
  });

  it('CONTENT_RATING_SUBSETS.light = [off, light]', () => {
    expect(CONTENT_RATING_SUBSETS.light).toEqual(['off', 'light']);
  });

  it('CONTENT_RATING_SUBSETS.full = [off, light, explicit, community]', () => {
    expect(CONTENT_RATING_SUBSETS.full).toEqual(['off', 'light', 'explicit', 'community']);
  });

  it('sfw 子集 ⊂ light 子集 ⊂ full 子集（单调递增）', () => {
    const sfw   = new Set(CONTENT_RATING_SUBSETS.sfw);
    const light = new Set(CONTENT_RATING_SUBSETS.light);
    const full  = new Set(CONTENT_RATING_SUBSETS.full);
    for (const r of sfw)   expect(light.has(r)).toBe(true);
    for (const r of light) expect(full.has(r)).toBe(true);
  });

  it('内容分级 enum 合法值（off/light/explicit/community）均在 full 子集内', () => {
    const fullSet = new Set(CONTENT_RATING_SUBSETS.full);
    for (const rating of ['off', 'light', 'explicit', 'community']) {
      expect(fullSet.has(rating)).toBe(true);
    }
  });
});

// ── DEFAULT_NSFW_CONTENT P0 占位结构 ─────────────────────────────────────────

describe('B-NSFW · DEFAULT_NSFW_CONTENT P0 结构', () => {
  it('导出六个默认串字段', () => {
    const keys = Object.keys(DEFAULT_NSFW_CONTENT);
    expect(keys).toContain('claudeSystemAddon');
    expect(keys).toContain('claudeAssistantPrefill');
    expect(keys).toContain('geminiAssistantPrefill');
    expect(keys).toContain('glmAssistantPrefill');
    expect(keys).toContain('explicitStyleAddon');
    expect(keys).toContain('communityStyleAddon');
  });

  it('P0: 所有默认串为空字符串（内容待 P1 填入）', () => {
    for (const [key, val] of Object.entries(DEFAULT_NSFW_CONTENT)) {
      expect(typeof val, `${key} should be string`).toBe('string');
      expect(val, `${key} should be empty at P0`).toBe('');
    }
  });

  it('值均为 string 类型（类型安全检查）', () => {
    for (const val of Object.values(DEFAULT_NSFW_CONTENT)) {
      expect(typeof val).toBe('string');
    }
  });
});

// ── 隔离防回归门（CI 级检查）──────────────────────────────────────────────────
// 检查指定非隔离模块中 NSFW 内容相关字段的默认值是否仍为空。
// P0: 所有字段 optional 或 default('')。P1 上线内容时需通过 nsfwContent.ts import。
// 当此测试失败 = 有内容串散落在非指定模块（需移至 engine/nsfwContent.ts）。

describe('B-NSFW · 隔离防回归：非指定模块无非空 NSFW 默认串', () => {
  function readCoreFile(rel: string): string {
    return readFileSync(join(CORE_ROOT, rel), 'utf-8');
  }

  it('schema/dollar.ts: 风格补正提示词 default 为空字符串', () => {
    const src = readCoreFile('schema/dollar.ts');
    // 允许 .default('') 但禁止 .default('非空内容')
    const matches = [...src.matchAll(/风格补正提示词.*?\.default\('([^']*)'\)/g)];
    for (const m of matches) {
      expect(m[1], '风格补正提示词 default 应为空').toBe('');
    }
  });

  it('schema/dollar.ts: 解禁提示词 不含非空 .default', () => {
    const src = readCoreFile('schema/dollar.ts');
    // 如果有 .default('...')（非可选），内容须来自 nsfwContent.ts import
    const matches = [...src.matchAll(/解禁提示词.*?\.default\('([^']+)'\)/g)];
    expect(matches).toHaveLength(0);
  });

  it('schema/dollar.ts: 破限引子各子串 不含非空 .default', () => {
    const src = readCoreFile('schema/dollar.ts');
    // 思维链引子/预填串/注入角色 均为 .optional()，不得有非空 .default
    const nsfwFields = ['思维链引子', '预填串'];
    for (const field of nsfwFields) {
      const re = new RegExp(`${field}.*?\\.default\\('([^']+)'\\)`, 'g');
      const m = [...src.matchAll(re)];
      expect(m, `${field} 不应有非空 default`).toHaveLength(0);
    }
  });

  it('prompt/index.ts: 无硬编码 NSFW 内容串（路由逻辑仅用 import 来的常量）', () => {
    const src = readCoreFile('prompt/index.ts');
    // 验证 prompt 层不含内容超过 30 字符的中文字符串字面量（排除注释）
    // 注：此检查是结构性检查，非语义 NSFW 内容过滤
    const codeLines = src.split('\n').filter(l => !l.trim().startsWith('//'));
    const longChinese = codeLines.filter(l =>
      /['"`][^'"`]{30,}[一-鿿][^'"`]{10,}['"`]/.test(l)
    );
    // 允许 explicitReason 字段的中文注释性文案（这是路由日志，不是 NSFW 内容）
    // 规则：如果超长中文串含「NSFW」且不是路由日志/理由，则标记
    const suspicious = longChinese.filter(l =>
      !l.includes('explicitReason') && !l.includes('//') && l.includes('NSFW')
    );
    expect(suspicious, '疑似散落 NSFW 内容串').toHaveLength(0);
  });

  it('nsfwContent.ts 是 DEFAULT_NSFW_CONTENT 的唯一定义源', () => {
    // 在非指定文件中搜索 DEFAULT_NSFW_CONTENT 的定义（而非 import）
    const dollar = readCoreFile('schema/dollar.ts');
    const memory = readCoreFile('schema/memory.ts');
    const promptIdx = readCoreFile('prompt/index.ts');
    for (const [name, src] of [['dollar.ts', dollar], ['memory.ts', memory], ['prompt/index.ts', promptIdx]] as const) {
      expect(src, `${name} 不应定义 DEFAULT_NSFW_CONTENT`).not.toMatch(/DEFAULT_NSFW_CONTENT\s*=/);
      expect(src, `${name} 不应定义 NSFW_BASELINE`).not.toMatch(/NSFW_BASELINE\s*=/);
    }
  });
});
