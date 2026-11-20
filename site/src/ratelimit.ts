export interface RateLimitOptions {
  /** Pedidos permitidos por janela. */
  limite: number;
  janelaMs: number;
  /** Máximo de chaves (IPs) guardadas; as janelas mais antigas saem primeiro. */
  maxChaves?: number;
  agora?: () => number;
}

export interface Consumo {
  ok: boolean;
  /** Segundos até a janela atual acabar (para o `Retry-After`). */
  retryAfterS: number;
}

interface Janela {
  inicio: number;
  usados: number;
}

/** Janela fixa por chave (IP). O mapa é limitado: janelas vencidas e as mais antigas saem. */
export class RateLimiter {
  private janelas = new Map<string, Janela>();
  private readonly maxChaves: number;
  private readonly agora: () => number;

  constructor(private readonly opts: RateLimitOptions) {
    this.maxChaves = opts.maxChaves ?? 10_000;
    this.agora = opts.agora ?? Date.now;
  }

  consumir(chave: string): Consumo {
    const agora = this.agora();
    const inicio = agora - (agora % this.opts.janelaMs);
    let j = this.janelas.get(chave);
    if (!j || j.inicio !== inicio) {
      this.janelas.delete(chave);
      j = { inicio, usados: 0 };
      this.janelas.set(chave, j);
      this.limpar(inicio);
    }
    const retryAfterS = Math.max(1, Math.ceil((inicio + this.opts.janelaMs - agora) / 1000));
    if (j.usados >= this.opts.limite) return { ok: false, retryAfterS };
    j.usados++;
    return { ok: true, retryAfterS };
  }

  get tamanho(): number {
    return this.janelas.size;
  }

  /** Chamado só quando uma janela nova entra: o `Map` está em ordem de início de janela. */
  private limpar(inicioAtual: number): void {
    for (const [k, j] of this.janelas) {
      if (j.inicio >= inicioAtual && this.janelas.size <= this.maxChaves) break;
      this.janelas.delete(k);
    }
  }
}

/** Lançado por `Semaforo.executar` quando a fila de espera está cheia. */
export class FilaCheia extends Error {
  constructor() {
    super('fila de espera cheia');
    this.name = 'FilaCheia';
  }
}

/** Limita tarefas simultâneas; as excedentes esperam numa fila de tamanho limitado. */
export class Semaforo {
  private ativos = 0;
  private fila: (() => void)[] = [];

  constructor(
    private readonly max: number,
    private readonly maxFila: number
  ) {
    if (!Number.isInteger(max) || max < 1) throw new Error(`Semaforo: limite inválido (${max})`);
  }

  async executar<T>(tarefa: () => Promise<T>): Promise<T> {
    if (this.ativos >= this.max) {
      if (this.fila.length >= this.maxFila) throw new FilaCheia();
      await new Promise<void>((liberar) => this.fila.push(liberar));
    } else {
      this.ativos++;
    }
    try {
      return await tarefa();
    } finally {
      // passa a vaga direto ao próximo da fila (ativos não muda) ou a devolve
      const proximo = this.fila.shift();
      if (proximo) proximo();
      else this.ativos--;
    }
  }
}
