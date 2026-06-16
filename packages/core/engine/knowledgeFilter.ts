// M4 知情过滤 — 唯一正典实现（禁第二实现）
// 展示层函数·不进指纹（不影响任何判定·仅控制送入 LLM 的叙事上下文）
//
// 设计决议（M4）：
//   此函数仅影响 LLM 叙事上下文，不影响检定/结算/RNG 判定。
//   判定输入不走此路径 → 不进指纹（B1d 排除名单）。
//
// 铁律（existence-opaque）：
//   非知情方连秘密存在性都不可见——不是"看不到内容"，
//   是"连'这里有个秘密'的痕迹都没有"。
//
// 受众选择器 MVP 口径：对象 = 字面实体键（精确匹配）。
//   未来可扩展为谓词（"faction:officials"），届时替换此函数不增实现。
import type { 秘密库条目Type } from '../schema/secret.js';

/** 过滤后可见秘密（仅非 $ 字段；$谜底 永不输出）*/
export interface VisibleSecret {
  母题:   string;
  严重度: number;
  暴露度: number;
}

/**
 * 知情过滤（∩ 窗）。
 *
 * 返回 povEntityKey 可见的秘密子集：
 *   - 知情方：返回 { 母题, 严重度, 暴露度 }（$谜底 永不输出）
 *   - 非知情方：条目完全不返回（existence-opaque）
 *
 * 知情判定：知情名单[i].对象 === povEntityKey（字面匹配·MVP）
 */
export function filterSecretsForPOV(
  secrets: Record<string, 秘密库条目Type>,
  povEntityKey: string,
): Record<string, VisibleSecret> {
  const result: Record<string, VisibleSecret> = {};
  for (const [id, secret] of Object.entries(secrets)) {
    if (secret.知情名单.some(e => e.对象 === povEntityKey)) {
      result[id] = {
        母题:   secret.母题,
        严重度: secret.严重度,
        暴露度: secret.暴露度,
      };
    }
  }
  return result;
}

/**
 * 检查指定实体是否知晓指定秘密（知情名单字面匹配·MVP）。
 */
export function entityKnowsSecret(
  secret: 秘密库条目Type,
  entityKey: string,
): boolean {
  return secret.知情名单.some(e => e.对象 === entityKey);
}
