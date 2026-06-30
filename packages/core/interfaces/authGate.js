// B5 · M2 覆写授权源认证（纯·接 6d71770）
//
// 永久契约（拍板 2026-06-17）：
//   当 mod 经普通通道宣称覆写/天命授权但 授权源 无效时判定越权（写墓碑）。
//   活的 fire（对导入数据跑）defer B6；本文件只交谓词 + 墓碑写入 helper。
//
// 红线：本文件不 import rng/hashPresetFingerprint/gate/fingerprintManifest/schema/zod
// B6 defer：M2 越权活线 fire 接入导入闸；registry 成员级 fire；仲裁
// ── 有效覆写授权源（封闭枚举·普通通道允许的最小可信集） ──────────────────────────────
// 天命通道来源「天命」有意不在此列：mod 经普通通道宣称天命授权即越权（天命通道越权）。
export const VALID_OVERWRITE_AUTH_SOURCES = Object.freeze([
    '系统',
    '裁判',
    '玩家确认',
]);
// 天命通道来源标志：mod 宣称此授权源但走普通通道即为越权
export const DESTINY_CHANNEL_SOURCE = '天命';
/**
 * 判定 mod 是否通过普通通道宣称了无效的覆写/天命授权源。
 * 越权条件：授权源不在 VALID_OVERWRITE_AUTH_SOURCES 白名单内（含空串）。
 * 天命通道越权：授权源 = DESTINY_CHANNEL_SOURCE（试图经普通通道仿冒天命通道）。
 * 纯函数·无副作用·无随机·无时钟·确定性。
 */
export function checkM2Violation(授权源) {
    if (VALID_OVERWRITE_AUTH_SOURCES.includes(授权源)) {
        return { violation: false };
    }
    let 诊断;
    if (授权源 === DESTINY_CHANNEL_SOURCE) {
        诊断 = `天命通道越权：mod 经普通通道宣称天命授权源「${授权源}」，不在覆写白名单`;
    }
    else if (授权源 === '') {
        诊断 = '覆写授权源为空串，授权源无效，拒收';
    }
    else {
        诊断 = `无效覆写授权源「${授权源}」，不在许可白名单 [${VALID_OVERWRITE_AUTH_SOURCES.join(', ')}]`;
    }
    return { violation: true, reason: '覆写授权越权', 诊断 };
}
/**
 * 纯函数：构造 M2 越权墓碑条目。
 * 确定性·无 wall-clock·无随机·无顺序敏感内容。
 * 与 mod墓碑条目Schema 的 strict() 兼容（记录键+原因必填·pack_id/诊断可选）。
 * 相同输入恒同输出（幂等）。
 */
export function writeM2Tombstone(记录键, pack_id, 诊断) {
    if (pack_id !== undefined && 诊断 !== undefined) {
        return { 记录键, pack_id, 原因: '覆写授权越权', 诊断 };
    }
    if (pack_id !== undefined) {
        return { 记录键, pack_id, 原因: '覆写授权越权' };
    }
    if (诊断 !== undefined) {
        return { 记录键, 原因: '覆写授权越权', 诊断 };
    }
    return { 记录键, 原因: '覆写授权越权' };
}
