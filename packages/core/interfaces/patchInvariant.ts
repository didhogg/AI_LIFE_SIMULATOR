// B5 · M3 规则补丁负面清单（纯·接 6d71770）
//
// 永久契约（拍板 2026-06-17）：
//   结构不变量硬排除字段集：delta path 首段以「_」或「$」开头者，禁止任何 op 写入。
//   forward-only 键列表：下列路径只允许增（sub 为结构违例；set 的值比较 defer B6）。
//   superRefine 仅管纯结构违例；语义越权（M2 墓碑）分离。
//
// 与 schema/memory.ts 中 intervention_pack_v1Schema.superRefine 实装规则一致；
// 本文件为公开 API，供 B6 导入闸及独立测试消费。
//
// 红线：本文件不 import rng/hashPresetFingerprint/gate/fingerprintManifest/zod/schema
// B6 defer：活线接入导入闸 fire；语义级 set 值比较（forward-only 下调）

// ── 结构不变量硬排除前缀（静态 const·首段以此开头的路径禁写） ─────────────────────
// 「_」= 系统/审计字段（_作弊标记/_mod墓碑库/_覆写日志/_编年史 等）
// 「$」= 玩家私有/AI 不可见字段（$谜底/$天命重掷券/$存档种子 等）
export const M3_HARD_EXCLUDED_PREFIXES = Object.freeze(['_', '$'] as const);

// ── forward-only 键路径（静态 const·只增不减） ───────────────────────────────────
// 这些路径的值只允许增大（sub op 为结构违例·set 值比较 defer B6）
export const M3_FORWARD_ONLY_PATHS = Object.freeze([
  '编年史.序号',
  '落账记录.序号',
] as const);

type DeltaOp = 'set' | 'add' | 'sub' | 'clamp' | 'lock';

/**
 * 判定路径是否命中 M3 硬排除：首段以「_」或「$」开头即拒收。
 * 纯函数·确定性·无副作用。
 */
export function isM3HardExcluded(path: string): boolean {
  const firstSeg = path.split('.')[0] ?? '';
  return firstSeg.startsWith('_') || firstSeg.startsWith('$');
}

/**
 * 判定 (path, op) 是否为 forward-only 路径的逆向操作（结构违例）。
 * forward-only 路径禁止 sub；其他 op 合法（set 的值比较 defer B6）。
 * 纯函数·确定性·无副作用。
 */
export function isM3ForwardOnlyViolation(path: string, op: DeltaOp | string): boolean {
  return (M3_FORWARD_ONLY_PATHS as readonly string[]).includes(path) && op === 'sub';
}

/**
 * 综合 M3 检验：返回结构违例描述（非 null 即违例），合法则返回 null。
 * 优先检查硬排除，次检查 forward-only 逆向，最后检查 forward-only set 值单调性。
 * oldValue/newValue 为可选参数（B6·⊕-3·向下兼容：旧两参调用零改）。
 * 纯函数·确定性。供 superRefine 及独立测试使用。
 */
export function getM3Violation(
  path: string,
  op: DeltaOp | string,
  oldValue?: unknown,
  newValue?: unknown,
): string | null {
  if (isM3HardExcluded(path)) {
    return `M3: 路径「${path}」首段以「_」或「$」开头，为结构不变量硬排除字段，禁止写入`;
  }
  if (isM3ForwardOnlyViolation(path, op)) {
    return `M3: 路径「${path}」为 forward-only 键，禁止 sub 操作（逆向违例）`;
  }
  // B6·⊕-3: forward-only set 值比较（有新旧值时启用·缺省 skip·向下兼容）
  if (
    (M3_FORWARD_ONLY_PATHS as readonly string[]).includes(path) &&
    op === 'set' &&
    oldValue !== undefined &&
    newValue !== undefined
  ) {
    if (typeof oldValue !== 'number' || typeof newValue !== 'number') {
      return `M3: forward-only 路径「${path}」set op 新旧值须为 number（oldValue: ${typeof oldValue}·newValue: ${typeof newValue}）`;
    }
    if (newValue < oldValue) {
      return `M3: forward-only set 不可回退：路径「${path}」新值 ${newValue} < 旧值 ${oldValue}`;
    }
  }
  return null;
}
