// FNV-1a 32-bit hash primitive — pure, zero dependencies.
// rng.ts keeps its own private copy (red line, cannot modify); this export serves
// consumers that must not import rng.ts (single-direction boundary).
export function fnv1a32(s: string): number {
  let h = 2166136261; // 32-bit FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
