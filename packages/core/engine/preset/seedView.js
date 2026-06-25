// 种子视图生成器 — 递归剥除 ZodDefault/ZodEffects·全字段 optional
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 不改 schemaKeys / BUNDLE / manifest · 零 migration_version 变更
// 纯函数·无副作用·禁 Date.now/Math.random/window/document
import { z } from 'zod';
export function 种子视图(schema, cache = new Map()) {
    if (cache.has(schema))
        return cache.get(schema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def = schema._def;
    const t = def?.typeName;
    const put = (s) => { cache.set(schema, s); return s; };
    switch (t) {
        case 'ZodDefault':
            return put(种子视图(def.innerType, cache));
        case 'ZodEffects':
            return put(种子视图(def.schema, cache));
        case 'ZodOptional':
        case 'ZodNullable':
            return put(种子视图(def.innerType, cache));
        case 'ZodObject': {
            const shape = def.shape();
            const ns = {};
            for (const k of Object.keys(shape)) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                ns[k] = 种子视图(shape[k], cache).optional();
            }
            return put(z.object(ns).passthrough());
        }
        case 'ZodArray':
            return put(z.array(种子视图(def.type, cache)));
        case 'ZodRecord':
            return put(z.record(def.keyType, 种子视图(def.valueType, cache)));
        case 'ZodDiscriminatedUnion': {
            const disc = def.discriminator;
            const options = def.options;
            const opts = options.map((opt) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sh = opt._def.shape();
                const ns = {};
                for (const k of Object.keys(sh)) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    ns[k] = k === disc ? sh[k] : 种子视图(sh[k], cache).optional();
                }
                return z.object(ns).passthrough();
            });
            return put(z.discriminatedUnion(disc, opts));
        }
        case 'ZodUnion': {
            const options = def.options;
            return put(z.union(options.map((o) => 种子视图(o, cache))));
        }
        case 'ZodTuple': {
            const items = def.items;
            return put(z.tuple(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items.map((i) => 种子视图(i, cache))));
        }
        case 'ZodLazy':
            return put(z.lazy(() => 种子视图(def.getter(), cache)));
        default:
            return put(schema);
    }
}
