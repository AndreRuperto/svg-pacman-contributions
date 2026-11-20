/** Leitura dos dados do ranking e do jogador, usada pela API JSON e pelas telas. */
import { addDays } from './datas.js';
import type { Jogador, Publicado } from './jogadores.js';
import { rankPlayers, type Aba, type Periodo } from './ranking.js';
import { chaveLogin, type PartidaRepo, type PartidaSalva } from './repo.js';

export const ABAS: readonly Aba[] = ['pontos', 'eficiencia'];
export const PERIODOS: readonly Periodo[] = ['hoje', '7d', 'recorde'];

export interface LinhaRanking {
  posicao: number;
  login: string;
  /** Métrica da aba (no período `7d`, a média). */
  valor: number;
  /** As duas métricas: da partida de referência, ou as médias no período `7d`. */
  pontos: number;
  eficiencia: number;
  /** Da partida de referência (no `7d`, a mais recente). */
  fantasmas: number;
  mortes: number;
  quadros: number;
  data: string;
}

export interface DadosRanking {
  aba: Aba;
  periodo: Periodo;
  hoje: string;
  linhas: LinhaRanking[];
}

export interface DadosJogador {
  login: string;
  desde: string;
  /** Data decrescente. */
  partidas: PartidaSalva[];
  recorde: PartidaSalva | null;
  media30: number | null;
  posicaoHoje: { pontos: number | null; eficiencia: number | null };
  publicado: Publicado | null;
}

export function acharJogador(lista: Jogador[], login: string): Jogador | undefined {
  const k = chaveLogin(login);
  return lista.find((j) => chaveLogin(j.login) === k);
}

/** Troca o login gravado pela grafia da lista (o repositório guarda a da última gravação). */
function comGrafiaDaLista(partidas: PartidaSalva[], lista: Jogador[]): PartidaSalva[] {
  const grafia = new Map(lista.map((j) => [chaveLogin(j.login), j.login]));
  return partidas.map((p) => ({ ...p, login: grafia.get(chaveLogin(p.login)) ?? p.login }));
}

/** Melhor partida não interrompida por pontos; empate: menos mortes, depois a mais antiga. */
function recordeDe(partidas: PartidaSalva[]): PartidaSalva | null {
  const validas = partidas.filter((p) => !p.interrompida);
  validas.sort((a, b) => b.pontos - a.pontos || a.mortes - b.mortes || a.data.localeCompare(b.data));
  return validas[0] ?? null;
}

export async function carregarRanking(
  repo: PartidaRepo,
  lista: Jogador[],
  aba: Aba,
  periodo: Periodo,
  hoje: string
): Promise<DadosRanking> {
  const logins = lista.map((j) => j.login);
  const brutas =
    periodo === 'hoje'
      ? await repo.entre(hoje, hoje, logins)
      : periodo === '7d'
        ? await repo.entre(addDays(hoje, -6), hoje, logins)
        : await repo.todasDe(logins);
  const partidas = comGrafiaDaLista(brutas, lista);
  const opcoes = { periodo, hoje };
  // No 7d, a outra métrica também é a média do período, não a da partida mais recente.
  const outra = aba === 'pontos' ? 'eficiencia' : 'pontos';
  const mediaOutra =
    periodo === '7d'
      ? new Map(rankPlayers(partidas, { ...opcoes, aba: outra }).map((l) => [chaveLogin(l.login), l.valor]))
      : null;

  const linhas = rankPlayers(partidas, { ...opcoes, aba }).map(({ posicao, login, valor, partida }) => {
    const valorOutra = mediaOutra?.get(chaveLogin(login)) ?? partida[outra];
    return {
      posicao,
      login,
      valor,
      pontos: aba === 'pontos' ? valor : valorOutra,
      eficiencia: aba === 'eficiencia' ? valor : valorOutra,
      fantasmas: partida.fantasmas,
      mortes: partida.mortes,
      quadros: partida.quadros,
      data: partida.data
    };
  });
  return { aba, periodo, hoje, linhas };
}

export async function carregarJogador(
  repo: PartidaRepo,
  lista: Jogador[],
  jogador: Jogador,
  hoje: string
): Promise<DadosJogador> {
  const k = chaveLogin(jogador.login);
  const partidas = comGrafiaDaLista(await repo.porJogador(jogador.login), lista);

  const inicio30 = addDays(hoje, -29);
  const ultimos30 = partidas.filter((p) => p.data >= inicio30 && p.data <= hoje);
  const media30 = ultimos30.length ? ultimos30.reduce((s, p) => s + p.pontos, 0) / ultimos30.length : null;

  const logins = lista.map((j) => j.login);
  const doDia = comGrafiaDaLista(await repo.entre(hoje, hoje, logins), lista);
  const posicao = (aba: Aba): number | null =>
    rankPlayers(doDia, { aba, periodo: 'hoje', hoje }).find((l) => chaveLogin(l.login) === k)?.posicao ?? null;

  return {
    login: jogador.login,
    desde: jogador.desde,
    partidas,
    recorde: recordeDe(partidas),
    media30,
    posicaoHoje: { pontos: posicao('pontos'), eficiencia: posicao('eficiencia') },
    publicado: jogador.publicado ?? null
  };
}
