// LOD-B3 · 挂载/生成接口泛化
// 注册表 = 引擎侧模块级 Map·不进 RootState·不进 schema·不进 schemaKeys
// Ring 0·确定性·六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
//
// P4-7  LodMountDescriptor<S>   — 模块挂载描述符泛型
// P4-8  registerLodMount        — 幂等注册（同键覆盖）
// P4-9  dispatchLodGenerate     — 注册表驱动生成分派（骨架或自定义生成器）
// P4-10 NPC_LOD_DESCRIPTOR      — NPC 默认描述符（delegate materializeCoarseNode）
//
// 红线：materializeCoarseNode 签名/body 一字不改（grep 证）

import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import type { RootState } from '../schema/index.js';
import type { 合一占位形态 } from '../schema/lodTable.js';
import { 种子视图 } from './preset/seedView.js';
import { materializeCoarseNode } from './lodEngine.js';
import { NpcSchema } from '../schema/actor.js';

// ── 泛型接口 ─────────────────────────────────────────────────────────────────

export interface LodGenCtx {
  s: RootState;
  nodeKey: string;
  entityKey: string;
}

/**
 * 模块LOD挂载描述符。
 * S = 模块真相 Zod Schema（用于骨架生成 + S.parse 落桶）。
 */
export interface LodMountDescriptor<S extends ZodTypeAny> {
  /** 模块唯一键（注册表主键·幂等·同键后注册覆盖前者） */
  模块键: string;
  /** 模块个体真相 Schema（用于 种子视图 骨架 + S.parse 验证） */
  真相Schema: S;
  /** 返回该 nodeKey 下需要物化的实体键列表（纯·只读） */
  索引器: (s: RootState, nodeKey: string) => string[];
  /** 将生成结果写入 state（in-place·调用方已 structuredClone） */
  写入目标: (s: RootState, entityKey: string, data: z.infer<S>) => void;
  /** 自定义生成器（可选）：有=调之；无=通用骨架路径 */
  生成器?: (
    占位: 合一占位形态 | undefined,
    seed: number,
    ctx: LodGenCtx,
  ) => z.infer<S> | void;
  /** 惰性预留·充血工具引用（B3 不消费） */
  充血工具引用?: string;
  /**
   * 泛型数值轴读取器（可选）·零 switch·注册表驱动。
   * 条件④ buildLodDriftCtx 调用：从 state 读取 nodeKey 对应的具名轴值（如 声望/民心）。
   * 返回 undefined → fail-closed → 该轴漂移=0 → 谓词不触发。
   */
  读数值轴?: (s: RootState, nodeKey: string, axis: string) => number | undefined;
}

// ── 模块级注册表（静态·运行期只读·测试用 clear） ─────────────────────────────

const _registry = new Map<string, LodMountDescriptor<ZodTypeAny>>();

/** 幂等注册（同键覆盖）。 */
export function registerLodMount<S extends ZodTypeAny>(
  descriptor: LodMountDescriptor<S>,
): void {
  _registry.set(
    descriptor.模块键,
    descriptor as unknown as LodMountDescriptor<ZodTypeAny>,
  );
}

/** 清空注册表（仅供测试隔离使用）。 */
export function clearLodRegistry(): void {
  _registry.clear();
}

/** 按模块键查找描述符（测试用）。 */
export function getLodMount(模块键: string): LodMountDescriptor<ZodTypeAny> | undefined {
  return _registry.get(模块键);
}

// ── 主分派入口 ────────────────────────────────────────────────────────────────

/**
 * LOD 生成分派（注册表驱动）。
 * 遍历所有已注册模块 → 索引器找到 nodeKey 下待物化实体 → 分派生成器或通用骨架路径。
 *
 * 自定义生成器路径：descriptor.生成器(占位, seed, ctx)
 *   - 返回 void    = 生成器已 in-place 处理（NPC 路径）·不额外写
 *   - 返回非 void  = 用 真相Schema.safeParse 验证 → 写入目标；fail-closed 跳过
 *
 * 通用骨架路径（无生成器）：
 *   种子视图(真相Schema) → parse(占位 ?? {}) → 真相Schema.safeParse → 写入目标；
 *   S.parse 失败 → fail-closed 跳过·不部分写·不抛。
 */
export function dispatchLodGenerate(
  s: RootState,
  nodeKey: string,
  seed: number,
): void {
  const 占位 = s.LOD表?.[nodeKey]?.占位形态;

  for (const descriptor of _registry.values()) {
    const entityKeys = descriptor.索引器(s, nodeKey);
    for (const entityKey of entityKeys) {
      const ctx: LodGenCtx = { s, nodeKey, entityKey };

      if (descriptor.生成器) {
        // ── 自定义生成器路径 ──────────────────────────────────────────────
        const result = descriptor.生成器(占位, seed, ctx);
        if (result !== undefined && result !== null) {
          const parsed = descriptor.真相Schema.safeParse(result);
          if (parsed.success) {
            descriptor.写入目标(s, entityKey, parsed.data);
          }
          // fail-closed: parse 失败 → skip
        }
        // void → in-place 已处理（NPC 路径）
      } else {
        // ── 通用骨架路径 ──────────────────────────────────────────────────
        try {
          const sv = 种子视图(descriptor.真相Schema);
          const partial = sv.parse(占位 ?? {});
          const full = descriptor.真相Schema.safeParse(partial);
          if (full.success) {
            descriptor.写入目标(s, entityKey, full.data);
          }
          // fail-closed: S.parse 失败 → skip
        } catch {
          // fail-closed: 种子视图 异常 → skip
        }
      }
    }
  }
}

// ── NPC 模块描述符 ────────────────────────────────────────────────────────────

/**
 * NPC LOD 挂载描述符。
 * 生成器 delegate 到 materializeCoarseNode（in-place·签名/body 一字不改）。
 * 索引器 只返回仍为 '粗' 态 NPC·promoteNode 先跑后调用时为空（幂等守卫）。
 */
export const NPC_LOD_DESCRIPTOR: LodMountDescriptor<typeof NpcSchema> = {
  模块键: 'NPC',
  真相Schema: NpcSchema,
  // LOD-B4b: 读 LOD表[k].档位 而非 NPC[k].LOD档位
  索引器: (s, nodeKey) =>
    Object.keys(s.NPC).filter(
      (k) => s.NPC[k]?.位置 === nodeKey && s.LOD表?.[k]?.档位 === '粗',
    ),
  写入目标: () => {
    /* NPC 生成器已 in-place via materializeCoarseNode·此处 no-op */
  },
  生成器: (_占位, seed, ctx) => {
    ctx.s.LOD表 ??= {};
    if (ctx.s.LOD表[ctx.entityKey]?.档位 !== '粗') return;
    materializeCoarseNode(ctx.s, ctx.entityKey, seed);
    // LOD-B4b: 调用方负责写 LOD表 档位
    ctx.s.LOD表[ctx.entityKey]!.档位 = '实体';
    // 返回 void：in-place 写入·调用方不再走写入目标
  },
};

/**
 * 注册 NPC LOD 描述符（显式调用·非自动 side-effect·保持测试隔离）。
 */
export function registerNpcLodMount(): void {
  registerLodMount(NPC_LOD_DESCRIPTOR);
}

/**
 * 注册全部生产 LOD 描述符（B4·server.js 引导阶段调用·幂等）。
 * 测试中通过 clearLodRegistry + 单独注册实现隔离，不调用此函数。
 */
export function registerProductionLodMounts(): void {
  registerNpcLodMount();
}
