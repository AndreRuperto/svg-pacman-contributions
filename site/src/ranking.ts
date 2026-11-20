import type { Partida } from '../../src/runner.js';

export type Aba = 'pontos' | 'eficiencia';
export type Periodo = 'hoje' | '7d' | 'recorde';

export interface RankOptions {
  aba: Aba;
  periodo: Periodo;
  /** AAAA-MM-DD (UTC). */
  hoje: string;
}

export interface Linha {
  posicao: number;
  login: string;
  valor: number;
  /** Partida de referência (fantasmas, mortes, duração). */
  partida: Partida;
}

/** Soma `n` dias a uma data AAAA-MM-DD, em UTC. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Candidata = Omit<Linha, 'posicao'>;

function compare(a: Candidata, b: Candidata): number {
  return b.valor - a.valor || a.partida.mortes - b.partida.mortes || (a.login < b.login ? -1 : a.login > b.login ? 1 : 0);
}

function porLogin(partidas: Partida[]): Map<string, Partida[]> {
  const grupos = new Map<string, Partida[]>();
  for (const p of partidas) {
    const lista = grupos.get(p.login);
    if (lista) lista.push(p);
    else grupos.set(p.login, [p]);
  }
  return grupos;
}

export function rankPlayers(partidas: Partida[], { aba, periodo, hoje }: RankOptions): Linha[] {
  const metrica = (p: Partida): number => p[aba];
  const linha = (p: Partida, valor = metrica(p)): Candidata => ({ login: p.login, valor, partida: p });
  let candidatas: Candidata[];

  if (periodo === 'hoje') {
    candidatas = partidas.filter((p) => p.data === hoje).map((p) => linha(p));
  } else if (periodo === '7d') {
    const inicio = addDays(hoje, -6);
    const janela = partidas.filter((p) => p.data >= inicio && p.data <= hoje);
    candidatas = [...porLogin(janela).values()].map((lista) => {
      const recente = lista.reduce((a, b) => (b.data > a.data ? b : a));
      const media = lista.reduce((s, p) => s + metrica(p), 0) / lista.length;
      return linha(recente, media);
    });
  } else {
    const validas = partidas.filter((p) => !p.interrompida);
    candidatas = [...porLogin(validas).values()].map(
      (lista) => lista.map((p) => linha(p)).sort(compare)[0]
    );
  }

  return candidatas.sort(compare).map((c, i) => ({ posicao: i + 1, ...c }));
}
