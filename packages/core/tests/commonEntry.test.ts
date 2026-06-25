import { describe, it, expect } from 'vitest';
import { 意象条目Schema } from '../schema/commonEntry.js';
import { NpcSchema } from '../schema/actor.js';
import { 地点条目Schema } from '../schema/map.js';

describe('意象条目Schema import-source', () => {
  it('意象条目Schema 可直接从 commonEntry 导入并 parse', () => {
    const result = 意象条目Schema.parse({ 标签: '神秘', 情绪色彩: '恐惧', 强度: 50 });
    expect(result.标签).toBe('神秘');
    expect(result.情绪色彩).toBe('恐惧');
    expect(result.强度).toBe(50);
    expect(result.来源).toBe('');
    expect(result.衰减速率).toBe(0);
  });

  it('NPC.意象 与 地点条目.意象 parse 同一形状', () => {
    const sample = [{ 标签: '幽暗', 情绪色彩: '压抑', 强度: 30, 来源: '固有', 衰减速率: 0 }];
    // Both fields are ZodDefault<ZodArray<意象条目Schema>>; parse via partial NPC/地点条目
    const npc = NpcSchema.parse({ 意象: sample });
    const loc = 地点条目Schema.parse({ 意象: sample });
    expect(npc.意象).toEqual(loc.意象);
    expect(npc.意象[0]?.标签).toBe('幽暗');
  });
});
