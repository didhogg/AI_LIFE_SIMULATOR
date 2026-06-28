// F5: formulaRegistry substrate machine tests
// 门控：默认值=硬编码值→零重定基·预设数字 override·DSL override·invalid-fail-safe·六禁·schemaKeys守恒
import { describe, test, expect } from 'vitest';
import {
  FORMULA_REGISTRY,
  FORMULA_POINT_KEYS,
  resolveFormula,
  resolveEffectiveFormula,
  type FormulaResolveConfig,
} from '../engine/formulaRegistry.js';
import { fixedExp } from '../engine/math/fixed.js';

// ── F5-1: 默认值等价守卫（零重定基） ──────────────────────────────────────────────
describe('F5-1 default values match hardcoded constants', () => {
  test('ripple_decay default = 0.5', () => {
    expect(resolveFormula('ripple_decay')).toBe(0.5);
  });
  test('ripple_min default = 1', () => {
    expect(resolveFormula('ripple_min')).toBe(1);
  });
  test('rel_ripple_threshold default = 50', () => {
    expect(resolveFormula('rel_ripple_threshold')).toBe(50);
  });
  test('chronicle_public_threshold default = 50', () => {
    expect(resolveFormula('chronicle_public_threshold')).toBe(50);
  });
  test('indirect_appraisal_factor default ≈ fixedExp(-ln2) ≈ 0.5', () => {
    const expected = fixedExp(-0.6931471805599453);
    expect(resolveFormula('indirect_appraisal_factor')).toBeCloseTo(expected, 10);
  });
  test('unknown_dim_coeff default = 0.3', () => {
    expect(resolveFormula('unknown_dim_coeff')).toBe(0.3);
  });
  test('region_hop_decay default = 0.7', () => {
    expect(resolveFormula('region_hop_decay')).toBe(0.7);
  });
  test('spatial_factor_min default = 0.1', () => {
    expect(resolveFormula('spatial_factor_min')).toBe(0.1);
  });
  test('spatial_factor_max default = 1.5', () => {
    expect(resolveFormula('spatial_factor_max')).toBe(1.5);
  });
  test('ic_rate_default default = 0.8', () => {
    expect(resolveFormula('ic_rate_default')).toBe(0.8);
  });
  test('resource_suppression_max default = 0.5', () => {
    expect(resolveFormula('resource_suppression_max')).toBe(0.5);
  });
  test('fake_edict_credibility_factor default = 0.5', () => {
    expect(resolveFormula('fake_edict_credibility_factor')).toBe(0.5);
  });
  test('seir_conflict_absorption_threshold default = 30', () => {
    expect(resolveFormula('seir_conflict_absorption_threshold')).toBe(30);
  });
  test('seir_conflict_absorption_factor default = 0.5', () => {
    expect(resolveFormula('seir_conflict_absorption_factor')).toBe(0.5);
  });
  test('memory_recency_rate default = 0.995', () => {
    expect(resolveFormula('memory_recency_rate')).toBe(0.995);
  });
  test('default_physique default = 10', () => {
    expect(resolveFormula('default_physique')).toBe(10);
  });
  test('default_loyalty default = 50', () => {
    expect(resolveFormula('default_loyalty')).toBe(50);
  });
  test('default_span_minutes default = 43200', () => {
    expect(resolveFormula('default_span_minutes')).toBe(43200);
  });
  test('check_proficiency_coeff default = 0.4', () => {
    expect(resolveFormula('check_proficiency_coeff')).toBe(0.4);
  });
  test('check_level_coeff default = 3', () => {
    expect(resolveFormula('check_level_coeff')).toBe(3);
  });
  test('attr_combine_divisor default = 2', () => {
    expect(resolveFormula('attr_combine_divisor')).toBe(2);
  });
  test('colocation_boost default = 30', () => {
    expect(resolveFormula('colocation_boost')).toBe(30);
  });
  test('prestige_scale default = 200', () => {
    expect(resolveFormula('prestige_scale')).toBe(200);
  });
  test('access_min default = 1', () => {
    expect(resolveFormula('access_min')).toBe(1);
  });
  test('investigation_boost_min default = 1', () => {
    expect(resolveFormula('investigation_boost_min')).toBe(1);
  });
  test('investigation_boost_max default = 30', () => {
    expect(resolveFormula('investigation_boost_max')).toBe(30);
  });
  test('belief_trust_threshold default = 60', () => {
    expect(resolveFormula('belief_trust_threshold')).toBe(60);
  });
  test('belief_certainty_perception_default default = 0', () => {
    expect(resolveFormula('belief_certainty_perception_default')).toBe(0);
  });
  test('belief_certainty_default default = 50', () => {
    expect(resolveFormula('belief_certainty_default')).toBe(50);
  });
  test('belief_certainty_secret default = 80', () => {
    expect(resolveFormula('belief_certainty_secret')).toBe(80);
  });
  test('lod_attr_range_lo default = 20', () => {
    expect(resolveFormula('lod_attr_range_lo')).toBe(20);
  });
  test('lod_attr_range_hi default = 60', () => {
    expect(resolveFormula('lod_attr_range_hi')).toBe(60);
  });
  test('economy_price_clamp_lo default = 0.5', () => {
    expect(resolveFormula('economy_price_clamp_lo')).toBe(0.5);
  });
  test('economy_price_clamp_hi default = 3.0', () => {
    expect(resolveFormula('economy_price_clamp_hi')).toBe(3.0);
  });
  test('economy_drift_threshold default = 0.2', () => {
    expect(resolveFormula('economy_drift_threshold')).toBe(0.2);
  });
  test('cross_domain_year_minutes default = 518400', () => {
    expect(resolveFormula('cross_domain_year_minutes')).toBe(518400);
  });
  test('rel_coloc_base default = 30', () => {
    expect(resolveFormula('rel_coloc_base')).toBe(30);
  });
  test('rel_org_bonus default = 30', () => {
    expect(resolveFormula('rel_org_bonus')).toBe(30);
  });
  test('rel_jitter_max default = 10', () => {
    expect(resolveFormula('rel_jitter_max')).toBe(10);
  });
  test('rel_trust default = 100', () => {
    expect(resolveFormula('rel_trust')).toBe(100);
  });
  test('rel_max_degree default = 10', () => {
    expect(resolveFormula('rel_max_degree')).toBe(10);
  });
  test('rel_depth_default default = 20', () => {
    expect(resolveFormula('rel_depth_default')).toBe(20);
  });
});

// ── F5-2: 注册表完整性 ───────────────────────────────────────────────────────────
describe('F5-2 registry completeness', () => {
  test('FORMULA_REGISTRY covers all FORMULA_POINT_KEYS', () => {
    for (const key of FORMULA_POINT_KEYS) {
      expect(FORMULA_REGISTRY[key]).toBeDefined();
      expect(typeof FORMULA_REGISTRY[key].defaultValue).toBe('number');
      expect(Number.isFinite(FORMULA_REGISTRY[key].defaultValue)).toBe(true);
    }
  });

  test('total formula point count = 43', () => {
    expect(FORMULA_POINT_KEYS.length).toBe(43);
  });
});

// ── F5-3: 预设数字 override（作者路径） ─────────────────────────────────────────
describe('F5-3 preset numeric override', () => {
  test('presetNumbers override takes effect', () => {
    const config: FormulaResolveConfig = {
      presetNumbers: { ripple_decay: 0.8 },
      enabled: true,
    };
    expect(resolveFormula('ripple_decay', config)).toBe(0.8);
  });

  test('other keys unaffected by partial presetNumbers', () => {
    const config: FormulaResolveConfig = {
      presetNumbers: { ripple_decay: 0.8 },
      enabled: true,
    };
    expect(resolveFormula('ripple_min', config)).toBe(1);
    expect(resolveFormula('memory_recency_rate', config)).toBe(0.995);
  });

  test('non-finite preset number falls back to default', () => {
    const config: FormulaResolveConfig = {
      presetNumbers: { ripple_decay: NaN },
      enabled: true,
    };
    expect(resolveFormula('ripple_decay', config)).toBe(0.5);
  });

  test('belief_certainty_default preset override takes effect', () => {
    const config: FormulaResolveConfig = {
      presetNumbers: { belief_certainty_default: 70 },
      enabled: true,
    };
    expect(resolveFormula('belief_certainty_default', config)).toBe(70);
  });

  test('belief_certainty_secret preset override takes effect', () => {
    const config: FormulaResolveConfig = {
      presetNumbers: { belief_certainty_secret: 95 },
      enabled: true,
    };
    expect(resolveFormula('belief_certainty_secret', config)).toBe(95);
  });

});

// ── F5-4: DSL 串 override（玩家路径） ──────────────────────────────────────────
describe('F5-4 DSL string override', () => {
  test('valid DSL integer constant overrides value', () => {
    const config: FormulaResolveConfig = {
      playerDsl: { ripple_min: '5' },
      enabled: true,
      ctx: {},
    };
    expect(resolveFormula('ripple_min', config)).toBe(5);
  });

  test('DSL arithmetic expression overrides value', () => {
    const config: FormulaResolveConfig = {
      playerDsl: { ripple_min: '3 + 2' },
      enabled: true,
      ctx: {},
    };
    expect(resolveFormula('ripple_min', config)).toBe(5);
  });

  test('invalid DSL string fail-safe returns default', () => {
    const config: FormulaResolveConfig = {
      playerDsl: { ripple_decay: 'NOT_VALID_DSL_@@@' },
      enabled: true,
      ctx: {},
    };
    expect(resolveFormula('ripple_decay', config)).toBe(0.5);
  });

  test('DSL takes priority over presetNumbers', () => {
    const config: FormulaResolveConfig = {
      playerDsl: { rel_ripple_threshold: '75' },
      presetNumbers: { rel_ripple_threshold: 30 },
      enabled: true,
      ctx: {},
    };
    expect(resolveFormula('rel_ripple_threshold', config)).toBe(75);
  });
});

// ── F5-5: enabled=false 短路守卫 ────────────────────────────────────────────────
describe('F5-5 enabled=false disables override', () => {
  test('enabled=false ignores DSL and preset, returns default', () => {
    const config: FormulaResolveConfig = {
      playerDsl: { ripple_decay: '0.9' },
      presetNumbers: { ripple_decay: 0.3 },
      enabled: false,
    };
    expect(resolveFormula('ripple_decay', config)).toBe(0.5);
  });
});

// ── F5-6: resolveEffectiveFormula 直接调用 ───────────────────────────────────────
describe('F5-6 resolveEffectiveFormula direct', () => {
  test('all-undefined falls back to defaultValue', () => {
    expect(resolveEffectiveFormula('ripple_decay', 0.5, undefined, undefined, true, {})).toBe(0.5);
  });

  test('presetConfigNumber used when no DSL', () => {
    expect(resolveEffectiveFormula('ripple_min', 1, 5, undefined, true, {})).toBe(5);
  });

  test('DSL wins over presetConfigNumber', () => {
    const result = resolveEffectiveFormula('ripple_min', 1, 3, '7', true, {});
    expect(result).toBe(7);
  });

  test('invalid DSL falls through to presetConfigNumber', () => {
    const result = resolveEffectiveFormula('ripple_decay', 0.5, 0.6, '@@INVALID@@', true, {});
    expect(result).toBe(0.6);
  });

  test('invalid DSL + no preset = default', () => {
    const result = resolveEffectiveFormula('ripple_decay', 0.5, undefined, '@@INVALID@@', true, {});
    expect(result).toBe(0.5);
  });

  test('enabled=false → always default', () => {
    const result = resolveEffectiveFormula('ripple_decay', 0.5, 0.6, '0.7', false, {});
    expect(result).toBe(0.5);
  });
});

// ── F5-7: 六禁验证（代码层面）──────────────────────────────────────────────────
// These tests confirm the registry module itself doesn't use forbidden APIs.
// The actual check is via static grep; here we verify the module loads cleanly.
describe('F5-7 six-prohibition compliance', () => {
  test('formulaRegistry module loads without throwing', () => {
    expect(FORMULA_REGISTRY).toBeDefined();
    expect(FORMULA_POINT_KEYS).toBeDefined();
  });

  test('all default values are finite numbers (no Infinity / NaN)', () => {
    for (const key of FORMULA_POINT_KEYS) {
      const val = FORMULA_REGISTRY[key].defaultValue;
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});
