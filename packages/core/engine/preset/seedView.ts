// 种子视图生成器 — 递归剥除 ZodDefault/ZodEffects·全字段 optional
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 不改 schemaKeys / BUNDLE / manifest · 零 migration_version 变更
// 纯函数·无副作用·禁 Date.now/Math.random/window/document
import { z } from 'zod';
import type { ZodTypeAny, ZodRawShape } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDef = any;

export function 种子视图(schema: ZodTypeAny, cache = new Map<ZodTypeAny, ZodTypeAny>()): ZodTypeAny {
  if (cache.has(schema)) return cache.get(schema)!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def: AnyDef = (schema as any)._def;
  const t: string | undefined = def?.typeName;
  const put = (s: ZodTypeAny): ZodTypeAny => { cache.set(schema, s); return s; };

  switch (t) {
    case 'ZodDefault':
      return put(种子视图(def.innerType as ZodTypeAny, cache));

    case 'ZodEffects':
      return put(种子视图(def.schema as ZodTypeAny, cache));

    case 'ZodOptional':
    case 'ZodNullable':
      return put(种子视图(def.innerType as ZodTypeAny, cache));

    case 'ZodObject': {
      const shape: ZodRawShape = def.shape();
      const ns: ZodRawShape = {};
      for (const k of Object.keys(shape)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ns[k] = 种子视图(shape[k]!, cache).optional();
      }
      return put(z.object(ns).passthrough());
    }

    case 'ZodArray':
      return put(z.array(种子视图(def.type as ZodTypeAny, cache)));

    case 'ZodRecord':
      return put(z.record(def.keyType as ZodTypeAny, 种子视图(def.valueType as ZodTypeAny, cache)));

    case 'ZodDiscriminatedUnion': {
      const disc: string = def.discriminator;
      const options: ZodTypeAny[] = def.options;
      const opts = options.map((opt) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sh: ZodRawShape = (opt as any)._def.shape();
        const ns: ZodRawShape = {};
        for (const k of Object.keys(sh)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ns[k] = k === disc ? sh[k]! : 种子视图(sh[k]!, cache).optional();
        }
        return z.object(ns).passthrough();
      });
      return put(
        z.discriminatedUnion(
          disc,
          opts as unknown as [z.ZodObject<ZodRawShape>, z.ZodObject<ZodRawShape>, ...z.ZodObject<ZodRawShape>[]]
        )
      );
    }

    case 'ZodUnion': {
      const options: ZodTypeAny[] = def.options;
      return put(
        z.union(
          options.map((o) => 种子视图(o, cache)) as unknown as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]
        )
      );
    }

    case 'ZodTuple': {
      const items: ZodTypeAny[] = def.items;
      return put(
        z.tuple(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items.map((i) => 种子视图(i, cache)) as any
        )
      );
    }

    case 'ZodLazy':
      return put(z.lazy(() => 种子视图(def.getter() as ZodTypeAny, cache)));

    default:
      return put(schema);
  }
}
