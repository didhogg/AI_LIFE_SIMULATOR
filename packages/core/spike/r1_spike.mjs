// R1-SPIKE: throwaway go/no-go gate · preset-slimming Phase B
// Run: node packages/core/spike/r1_spike.mjs  (from project root)
// ZERO production-code modifications — read-only consumers only.

import { z } from 'zod'; // v3.25.76

import { NpcSchema }           from '../schema/actor.js';
import { 组织实体条目Schema }  from '../schema/org.js';
import { RootSchema }           from '../schema/index.js';
import { hashPresetFingerprint } from '../engine/rng.js';
import { canonicalize }         from '../engine/text/canonicalize.js';
import { fnv1a32 }              from '../engine/text/fnv1a32.js';
import { runProposalGate }      from '../engine/proposal/runProposalGate.js';

// ─── Step 0 · 定位（打印找到的真实路径与签名）────────────────────────────────

console.log('\n══════ Step 0 · 定位 ══════');
console.log('NpcSchema              : packages/core/schema/actor.ts:397 (js:345)');
console.log('                         export const NpcSchema = z.object({...}) · 纯 ZodObject · default 饱和');
console.log('组织实体条目Schema     : packages/core/schema/org.ts:125  (js:109)');
console.log('                         export const 组织实体条目Schema = z.object({...})');
console.log('hashPresetFingerprint  : packages/core/engine/rng.ts:220');
console.log('  签名: hashPresetFingerprint(fields: {');
console.log('    判定面整包: string; 生效中内容包集哈希: string;');
console.log('    snapshot: { 难度系数组, 判定骰型: 100|20, 暴击映射, 钳制表, 预设数值面域上下界 };');
console.log('    ...optional fields');
console.log('  }): string   → fnv1a32(canonicalize(fields)).toString(16).padStart(8,"0")');
console.log('canonicalize           : packages/core/engine/text/canonicalize.ts:22');
console.log('  签名: canonicalize(value: unknown): string  → JSON.stringify with sorted keys');
console.log('fnv1a32                : packages/core/engine/text/fnv1a32.ts:4');
console.log('  签名: fnv1a32(s: string): number  → FNV-1a 32-bit hash');
console.log('runProposalGate        : packages/core/engine/proposal/runProposalGate.ts:60');
console.log('  签名: runProposalGate(rawEnvelope, state: RootState, seatId, 授权源, packs?) → ProposalGateResult');
console.log('  五道闸: ①Zod(指令信封) ②白名单+C6 ③M3前缀+L15 ④K5 delta+clamp ⑤审计日志');

// ─── Step 1 · 种子视图生成器（任务规格 verbatim）────────────────────────────

function 种子视图(schema, cache = new Map()) {
  if (cache.has(schema)) return cache.get(schema);
  const def = schema._def, t = def && def.typeName;
  const put = (s) => (cache.set(schema, s), s);
  switch (t) {
    case 'ZodDefault':  return put(种子视图(def.innerType, cache));
    case 'ZodEffects':  return put(种子视图(def.schema, cache));
    case 'ZodOptional':
    case 'ZodNullable': return put(种子视图(def.innerType, cache));
    case 'ZodObject': {
      const sh = def.shape(), ns = {};
      for (const k of Object.keys(sh)) ns[k] = 种子视图(sh[k], cache).optional();
      return put(z.object(ns).passthrough());
    }
    case 'ZodArray':  return put(z.array(种子视图(def.type, cache)));
    case 'ZodRecord': return put(z.record(def.keyType, 种子视图(def.valueType, cache)));
    case 'ZodDiscriminatedUnion': {
      const disc = def.discriminator;
      const opts = [...def.options].map((opt) => {
        const sh = opt._def.shape(), ns = {};
        for (const k of Object.keys(sh)) ns[k] = (k === disc) ? sh[k] : 种子视图(sh[k], cache).optional();
        return z.object(ns).passthrough();
      });
      return put(z.discriminatedUnion(disc, opts));
    }
    case 'ZodUnion': return put(z.union(def.options.map((o) => 种子视图(o, cache))));
    case 'ZodTuple': return put(z.tuple(def.items.map((i) => 种子视图(i, cache))));
    case 'ZodLazy':  return put(z.lazy(() => 种子视图(def.getter(), cache)));
    default:         return put(schema);
  }
}

const NPC种子视图 = 种子视图(NpcSchema);
const 组织种子视图 = 种子视图(组织实体条目Schema);

// ─── Step 2 · 最小数据（引用包 base + 局部覆盖 overlay）─────────────────────

const base = {
  NPC种子: {
    npc_jia: {
      姓名: '甲一',
      属性: { 体质: 60 },    // 属性 = record，体质 是 record 内的子项
    },
  },
  组织种子: {
    org_qinghe: { 类型: '帮派', 状态: '活跃' },
  },
};

const overlay = {
  NPC种子: {
    npc_jia: {
      姓名: '甲二（覆盖）',  // 覆盖 base 的 姓名
      属性: { 体质: 80 },    // 同 record 子项的相邻字段，值从 60 → 80
    },
  },
};

// 用种子视图验证 base 数据
console.log('\n══════ Step 2 · 种子视图 safeParse 验证 ══════');

const baseNpcParsed = NPC种子视图.safeParse(base.NPC种子.npc_jia);
if (!baseNpcParsed.success) {
  console.error('FAIL: base NPC种子视图 safeParse 失败', baseNpcParsed.error.message);
  process.exit(1);
}
const overlayNpcParsed = NPC种子视图.safeParse(overlay.NPC种子.npc_jia);
if (!overlayNpcParsed.success) {
  console.error('FAIL: overlay NPC种子视图 safeParse 失败', overlayNpcParsed.error.message);
  process.exit(1);
}
const baseOrgParsed = 组织种子视图.safeParse(base.组织种子.org_qinghe);
if (!baseOrgParsed.success) {
  console.error('FAIL: base 组织种子视图 safeParse 失败', baseOrgParsed.error.message);
  process.exit(1);
}
console.log('  base NPC种子视图.safeParse  → success:', baseNpcParsed.success);
console.log('  overlay NPC种子视图.safeParse → success:', overlayNpcParsed.success);
console.log('  base 组织种子视图.safeParse → success:', baseOrgParsed.success);

// ─── Step 3 · resolve（深合并 + schema 补全）────────────────────────────────

function deepMerge(base, overlay) {
  if (overlay === undefined || overlay === null) return base;
  if (base   === undefined || base   === null) return overlay;
  if (typeof overlay !== 'object' || Array.isArray(overlay)) return overlay;
  if (typeof base   !== 'object' || Array.isArray(base))   return overlay;
  const result = { ...base };
  for (const k of Object.keys(overlay)) {
    result[k] = deepMerge(base[k], overlay[k]);
  }
  return result;
}

function resolve(basePkg, overlayPkg) {
  // Merge seed-level data (no default injection here)
  const mergedNpcSeeds = {};
  for (const k of Object.keys(basePkg.NPC种子 ?? {})) {
    const overlayEntry = overlayPkg?.NPC种子?.[k] ?? {};
    mergedNpcSeeds[k] = deepMerge(basePkg.NPC种子[k], overlayEntry);
  }
  const mergedOrgSeeds = {};
  for (const k of Object.keys(basePkg.组织种子 ?? {})) {
    const overlayEntry = overlayPkg?.组织种子?.[k] ?? {};
    mergedOrgSeeds[k] = deepMerge(basePkg.组织种子[k], overlayEntry);
  }

  // Apply full schema parse (defaults fill here — only on resolved product side)
  const 成品NPC = {};
  for (const [k, seed] of Object.entries(mergedNpcSeeds)) {
    成品NPC[k] = NpcSchema.parse(seed);
  }
  const 成品組織 = {};
  for (const [k, seed] of Object.entries(mergedOrgSeeds)) {
    成品組織[k] = 组织实体条目Schema.parse(seed);
  }
  return { 成品NPC, 成品組織 };
}

const { 成品NPC, 成品組織 } = resolve(base, overlay);
const resolved = 成品NPC['npc_jia'];

// ─── Step 4 · 三条验收 ───────────────────────────────────────────────────────

let allPass = true;

// ──── (a) 种子不被 default 污染 ─────────────────────────────────────────────
console.log('\n══════ 验收(a) · 种子不被 default 污染 ══════');

const seedInput  = base.NPC种子['npc_jia'];
const seedOutput = NPC种子视图.parse(seedInput);
const inputKeys  = Object.keys(seedInput);
const outputKeys = Object.keys(seedOutput);

// 对比：NpcSchema.parse({}) 会注入多少 default 键
const fullDefaultKeys = Object.keys(NpcSchema.parse({}));

const keysMatch = (
  inputKeys.length === outputKeys.length &&
  inputKeys.every(k => outputKeys.includes(k))
);

if (keysMatch) {
  console.log('  PASS · 种子视图无 default 注入');
} else {
  console.log('  FAIL · 种子视图注入了额外键');
  console.log('    输入键:', inputKeys);
  console.log('    输出键:', outputKeys);
  allPass = false;
}

console.log(`  证据 — 输入键数: ${inputKeys.length}  种子视图输出键数: ${outputKeys.length}  NpcSchema.parse({})键数: ${fullDefaultKeys.length}`);
console.log(`  输入键集合: [${inputKeys.join(', ')}]`);
console.log(`  NpcSchema.parse({}) 顶层键数 ${fullDefaultKeys.length} （反衬：default 饱和会填入所有字段）`);

// 检查 passthrough：种子视图输出包含输入的 record 子项
const bodyValue = seedOutput['属性'];
const passOk = bodyValue !== undefined && bodyValue['体质'] === 60;
if (!passOk) {
  console.log('  FAIL · passthrough 失败，record 子项未保留');
  allPass = false;
} else {
  console.log('  PASS · passthrough 保留 record 子项: 属性.体质 =', bodyValue['体质']);
}

// ──── (b) resolve 后成品过校验 ──────────────────────────────────────────────
console.log('\n══════ 验收(b) · resolve 后成品过 NpcSchema + 五道闸 ══════');

// (b-1) NpcSchema parse
const npcParseResult = NpcSchema.safeParse(resolved);
if (npcParseResult.success) {
  console.log('  PASS · NpcSchema.safeParse(成品NPC) → success');
  console.log(`  证据 — 成品 NPC 顶层键数: ${Object.keys(resolved).length}`);
} else {
  console.log('  FAIL · NpcSchema.safeParse 失败:', npcParseResult.error.message);
  allPass = false;
}

// overlay 覆盖验证
const baseName    = base.NPC种子['npc_jia']['姓名'];
const overlayName = overlay.NPC种子['npc_jia']['姓名'];
const resolvedName = resolved['姓名'];

if (resolvedName === overlayName) {
  console.log(`  PASS · overlay 字段生效: 姓名 base="${baseName}" overlay="${overlayName}" resolved="${resolvedName}"`);
} else {
  console.log(`  FAIL · overlay 字段未生效: 姓名 resolved="${resolvedName}" (expected overlay="${overlayName}")`);
  allPass = false;
}

const baseBodyValue    = base.NPC种子['npc_jia']['属性']['体质'];
const overlayBodyValue = overlay.NPC种子['npc_jia']['属性']['体质'];
const resolvedBodyValue = resolved['属性']?.['体质'];

if (resolvedBodyValue === overlayBodyValue) {
  console.log(`  PASS · record子项覆盖: 属性.体质 base=${baseBodyValue} overlay=${overlayBodyValue} resolved=${resolvedBodyValue}`);
} else {
  console.log(`  FAIL · record子项未覆盖: 属性.体质 resolved=${resolvedBodyValue} (expected=${overlayBodyValue})`);
  allPass = false;
}

// (b-2) 五道闸 — 构造最小 state + K5 delta，走 runProposalGate
// 确认：RootSchema.parse({}) 带 NPC.npc_jia（成品）的最小 state
// 空 _席位表 → C6 单机退化 → eligible:true; 授权源='系统' → M2 通过
const minState = RootSchema.parse({
  NPC: { npc_jia: resolved },
});

const envelope = {
  提案: { 动作类别: 'attr_set', 目标引用: 'npc_jia' },
};

// K5 delta: set NPC.npc_jia.属性.体质 from overlay value → new value
// 路径 NPC.{id}.属性.体质 在白名单 probe 中已确认 writable
const k5Pack = [[{ path: 'NPC.npc_jia.属性.体质', op: 'set', value: 85 }]];

const gateResult = runProposalGate(envelope, minState, 'seat_0', '系统', k5Pack);

if (gateResult.ok) {
  const newBodyValue = gateResult.state['NPC']?.['npc_jia']?.['属性']?.['体质'];
  console.log('  PASS · runProposalGate → ok:true');
  console.log(`  证据 — gate 后 NPC.npc_jia.属性.体质: ${newBodyValue} (set from 80 → 85)`);
} else {
  console.log(`  FAIL · runProposalGate → ok:false  gate:${gateResult.gate}  reason:${gateResult.reason}`);
  allPass = false;
}

// ──── (c) 指纹确定性 ─────────────────────────────────────────────────────────
console.log('\n══════ 验收(c) · 指纹确定性 ══════');

// 用 canonicalize(成品NPC) 作为 hashPresetFingerprint 的 判定面整包 来测试确定性。
// 这样既用了真实的 hashPresetFingerprint 函数，又把实体内容嵌入指纹输入。
function entityFingerprint(entity) {
  const 判定面整包 = fnv1a32(canonicalize(entity)).toString(16).padStart(8, '0');
  return hashPresetFingerprint({
    判定面整包,
    生效中内容包集哈希: '00000000',
    snapshot: {
      难度系数组: {},
      判定骰型:   100,
      暴击映射:   '关',
      钳制表:     {},
      预设数值面域上下界: {},
    },
  });
}

// (c-1) 同一成品连跑 2 次相等
const fp1 = entityFingerprint(resolved);
const fp2 = entityFingerprint(resolved);
if (fp1 === fp2) {
  console.log(`  PASS · 同一成品连跑 2 次指纹相等: fp1="${fp1}" fp2="${fp2}"`);
} else {
  console.log(`  FAIL · 指纹不一致: fp1="${fp1}" fp2="${fp2}"`);
  allPass = false;
}

// (c-2) 打乱键顺序后 canonicalize 再算，指纹仍相等
const shuffled = Object.fromEntries(
  Object.entries(resolved).reverse()   // 简单反转键顺序
);
const fpShuffled = entityFingerprint(shuffled);
if (fp1 === fpShuffled) {
  console.log(`  PASS · 键顺序打乱后指纹仍相等: fp_shuffled="${fpShuffled}"`);
} else {
  console.log(`  FAIL · 键顺序影响了指纹: fp_orig="${fp1}" fp_shuffled="${fpShuffled}"`);
  allPass = false;
}

// (c-3) 改 1 个事实字段，指纹必须变化
const mutated = { ...resolved, 姓名: '绝对不同的名字_MUTATION' };
const fpMutated = entityFingerprint(mutated);
if (fp1 !== fpMutated) {
  console.log(`  PASS · 改字段后指纹变化: orig="${fp1}" mutated="${fpMutated}"`);
} else {
  console.log(`  FAIL · 改字段后指纹未变化 (碰撞或实现错误): fp="${fp1}"`);
  allPass = false;
}

// ─── Step 5 · 汇总 ───────────────────────────────────────────────────────────

console.log('\n══════ R1-SPIKE 汇总 ══════');
if (allPass) {
  console.log('R1-SPIKE GREEN → 放行破坏 PR');
  process.exit(0);
} else {
  console.log('R1-SPIKE RED → 回头改种子视图规格或验收条件');
  process.exit(1);
}
