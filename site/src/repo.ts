import type { Partida } from '../../src/runner.js';
import type { ReplaySnapshot } from './snapshot.js';

/** Partida como ela sai do repositório (sem `svg`, com o sha do SVG publicado daquele dia). */
export type PartidaSalva = Omit<Partida, 'svg'> & { publicado_sha: string | null };

/** Partida para gravar. `publicado_sha` ausente ou null mantém o que já estava gravado. */
export type PartidaNova = Partida & { publicado_sha?: string | null; snapshot?: ReplaySnapshot };

/**
 * Onde ficam as partidas. Os logins são comparados sem diferenciar maiúsculas
 * (a chave é o login em minúsculas); `login` guarda a grafia da última gravação.
 * Datas sempre AAAA-MM-DD (UTC).
 */
export interface PartidaRepo {
  upsert(p: PartidaNova): Promise<void>;
  /** Snapshot da janela usada pelo cron; null para registros históricos sem janela. */
  obterSnapshot(login: string, data: string): Promise<ReplaySnapshot | null>;
  /** Ordem: data decrescente. */
  porJogador(login: string): Promise<PartidaSalva[]>;
  /** De `de` a `ate`, inclusive, só dos `logins`. */
  entre(de: string, ate: string, logins: string[]): Promise<PartidaSalva[]>;
  /** Todas as partidas dos `logins` (para o recorde). */
  todasDe(logins: string[]): Promise<PartidaSalva[]>;
  /** Datas que já têm partida jogada nesta versão do motor. */
  datasExistentes(login: string, versao: string): Promise<Set<string>>;
  /** Grava o sha do SVG publicado; não faz nada se a partida não existir. */
  marcarPublicado(login: string, data: string, sha: string): Promise<void>;
  /** Registra um dia sem nenhuma contribuição na janela (nada para jogar). */
  marcarSemJogo(login: string, data: string, versao: string): Promise<void>;
  /** Dias registrados como sem jogo nesta versão do motor. */
  diasSemJogo(login: string, versao: string): Promise<Set<string>>;
}

export const chaveLogin = (login: string): string => login.toLowerCase();

const chave = (login: string, data: string) => `${chaveLogin(login)}|${data}`;

/** Repositório em memória, para testes e desenvolvimento. */
export class MemoryRepo implements PartidaRepo {
  private partidas = new Map<string, PartidaSalva>();
  private snapshots = new Map<string, ReplaySnapshot>();
  private semJogo = new Map<string, string>();

  async upsert(p: PartidaNova): Promise<void> {
    const k = chave(p.login, p.data);
    const anterior = this.partidas.get(k);
    // Nunca reutilizar um snapshot de uma execução anterior após regravar uma partida.
    if (p.snapshot === undefined) this.snapshots.delete(k);
    else this.snapshots.set(k, p.snapshot.map((linha) => [...linha] as typeof linha));
    // Só os campos do placar são listados; a janela fica acessível separadamente.
    this.partidas.set(k, {
      login: p.login,
      data: p.data,
      pontos: p.pontos,
      fantasmas: p.fantasmas,
      mortes: p.mortes,
      maior_combo: p.maior_combo,
      quadros: p.quadros,
      celulas: p.celulas,
      eficiencia: p.eficiencia,
      interrompida: p.interrompida,
      versao_motor: p.versao_motor,
      publicado_sha: p.publicado_sha ?? anterior?.publicado_sha ?? null
    });
  }

  async obterSnapshot(login: string, data: string): Promise<ReplaySnapshot | null> {
    const linhas = this.snapshots.get(chave(login, data));
    return linhas === undefined ? null : linhas.map((linha) => [...linha] as typeof linha);
  }

  async porJogador(login: string): Promise<PartidaSalva[]> {
    const k = chaveLogin(login);
    return this.lista((p) => chaveLogin(p.login) === k).sort((a, b) => b.data.localeCompare(a.data));
  }

  async entre(de: string, ate: string, logins: string[]): Promise<PartidaSalva[]> {
    const ks = new Set(logins.map(chaveLogin));
    return this.lista((p) => ks.has(chaveLogin(p.login)) && p.data >= de && p.data <= ate);
  }

  async todasDe(logins: string[]): Promise<PartidaSalva[]> {
    const ks = new Set(logins.map(chaveLogin));
    return this.lista((p) => ks.has(chaveLogin(p.login)));
  }

  async datasExistentes(login: string, versao: string): Promise<Set<string>> {
    const k = chaveLogin(login);
    return new Set(this.lista((p) => chaveLogin(p.login) === k && p.versao_motor === versao).map((p) => p.data));
  }

  async marcarPublicado(login: string, data: string, sha: string): Promise<void> {
    const p = this.partidas.get(chave(login, data));
    if (p) p.publicado_sha = sha;
  }

  async marcarSemJogo(login: string, data: string, versao: string): Promise<void> {
    this.semJogo.set(chave(login, data), versao);
  }

  async diasSemJogo(login: string, versao: string): Promise<Set<string>> {
    const prefixo = `${chaveLogin(login)}|`;
    const dias = new Set<string>();
    for (const [k, v] of this.semJogo) if (k.startsWith(prefixo) && v === versao) dias.add(k.slice(prefixo.length));
    return dias;
  }

  private lista(filtro: (p: PartidaSalva) => boolean): PartidaSalva[] {
    return [...this.partidas.values()].filter(filtro).map((p) => ({ ...p }));
  }
}
