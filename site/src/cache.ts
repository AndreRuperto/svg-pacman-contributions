/** Cache LRU com limite de itens (usa a ordem de inserção do `Map`). */
export class LruCache<V> {
  private itens = new Map<string, V>();

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new Error(`LruCache: limite inválido (${max})`);
  }

  get(chave: string): V | undefined {
    const v = this.itens.get(chave);
    if (v === undefined) return undefined;
    this.itens.delete(chave);
    this.itens.set(chave, v);
    return v;
  }

  set(chave: string, valor: V): void {
    this.itens.delete(chave);
    this.itens.set(chave, valor);
    while (this.itens.size > this.max) {
      const maisAntiga = this.itens.keys().next().value as string;
      this.itens.delete(maisAntiga);
    }
  }

  get size(): number {
    return this.itens.size;
  }
}
