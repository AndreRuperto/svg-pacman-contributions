/** FNV-1a de 32 bits: transforma a semente textual em inteiro. */
export const hashSeed = (seed: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: gerador rápido e reproduzível, devolve números em [0, 1). */
export const createRng = (seed: string): (() => number) => {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Mesma animação durante o dia; muda no dia seguinte. */
export const defaultSeed = (username: string, date: Date = new Date()): string =>
  `${username}:${date.toISOString().slice(0, 10)}`;
