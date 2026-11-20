import type { Partida } from '../../src/runner.js';
import { addDays, exigirHoje } from './datas.js';

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

type Candidata = Omit<Linha, 'posicao'>;

/** Valor decrescente, depois menos mortes, depois login (sem diferenciar maiúsculas). */
function compare(a: Candidata, b: Candidata): number {
  return (
    b.valor - a.valor ||
    a.partida.mortes - b.partida.mortes ||
    a.login.toLowerCase().localeCompare(b.login.toLowerCase())
  );
}

/** Para o recorde de um login: a melhor partida; em empate total, a mais antiga. */
function compareRecorde(a: Candidata, b: Candidata): number {
  return compare(a, b) || (a.partida.data < b.partida.data ? -1 : a.partida.data > b.partida.data ? 1 : 0);
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

/**
 * Partidas interrompidas contam em "hoje" e "7d" (são partidas reais);
 * só saem do recorde.
 */
export function rankPlayers(partidas: Partida[], { aba, periodo, hoje }: RankOptions): Linha[] {
  exigirHoje(hoje);
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
      (lista) => lista.map((p) => linha(p)).sort(compareRecorde)[0]
    );
  }

  return candidatas.sort(compare).map((c, i) => ({ posicao: i + 1, ...c }));
}
