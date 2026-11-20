export interface LruOptions<V> {
  /** Teto da soma dos pesos (ex.: bytes); sem ele, só o teto de itens vale. */
  maxPeso?: number;
  peso?: (v: V) => number;
}

/**
 * Cache LRU com teto de itens e, opcionalmente, de peso total
 * (usa a ordem de inserção do `Map`: o primeiro é o menos usado).
 */
export class LruCache<V> {
  private itens = new Map<string, { valor: V; peso: number }>();
  private pesoTotal = 0;
  private readonly maxPeso: number;
  private readonly pesoDe: (v: V) => number;

  constructor(
    private readonly max: number,
    opts: LruOptions<V> = {}
  ) {
    if (!Number.isInteger(max) || max < 1) throw new Error(`LruCache: limite inválido (${max})`);
    this.maxPeso = opts.maxPeso ?? Infinity;
    this.pesoDe = opts.peso ?? (() => 0);
  }

  get(chave: string): V | undefined {
    const item = this.itens.get(chave);
    if (item === undefined) return undefined;
    this.itens.delete(chave);
    this.itens.set(chave, item);
    return item.valor;
  }

  set(chave: string, valor: V): void {
    this.remover(chave);
    const peso = this.pesoDe(valor);
    // um item maior que o teto inteiro não entra (e não esvazia o cache)
    if (peso > this.maxPeso) return;
    this.itens.set(chave, { valor, peso });
    this.pesoTotal += peso;
    while (this.itens.size > this.max || this.pesoTotal > this.maxPeso) {
      this.remover(this.itens.keys().next().value as string);
    }
  }

  get size(): number {
    return this.itens.size;
  }

  get peso(): number {
    return this.pesoTotal;
  }

  private remover(chave: string): void {
    const item = this.itens.get(chave);
    if (!item) return;
    this.itens.delete(chave);
    this.pesoTotal -= item.peso;
  }
}
