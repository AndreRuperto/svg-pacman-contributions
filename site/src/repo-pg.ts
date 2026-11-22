import postgres from 'postgres';
import { gzipSync, gunzipSync } from 'node:zlib';
import { chaveLogin, type PartidaNova, type PartidaRepo, type PartidaSalva } from './repo.js';
import type { ReplaySnapshot } from './snapshot.js';
import { cacheavel, MAX_GZIP_BYTES, MAX_SVG_BYTES, MAX_CACHE_DAYS } from './replay-cache.js';

type Sql = postgres.Sql;

const SCHEMA = new URL('../sql/001_schema.sql', import.meta.url);

// `data::text` devolve AAAA-MM-DD (sem conversão para Date e sem fuso).
const COLUNAS = `login, data::text AS data, pontos, fantasmas, mortes, maior_combo, quadros, celulas,
  eficiencia, interrompida, versao_motor, publicado_sha`;

/** Repositório em Postgres (lib `postgres`). A chave é o login em minúsculas (`login_key`). */
export class PgRepo implements PartidaRepo {
  constructor(private readonly sql: Sql) {}

  static fromUrl(url: string): PgRepo {
    return new PgRepo(postgres(url, { max: 4, onnotice: () => {} }));
  }

  /** Cria as tabelas se não existirem (idempotente). */
  /**
   * Cria as tabelas. Web e cron podem subir juntos: um advisory lock (numa conexão
   * reservada, porque o lock é da sessão) faz um esperar o outro.
   */
  async migrate(): Promise<void> {
    const conexao = await this.sql.reserve();
    try {
      // sem esperar para sempre se outro processo travar segurando o lock
      await conexao`SET lock_timeout = '30s'`;
      await conexao`SELECT pg_advisory_lock(hashtext('pacman-migrate'))`;
      try {
        await conexao.file(SCHEMA);
      } finally {
        // uma falha aqui não pode esconder o erro da migração (se a conexão caiu, o lock caiu junto)
        try {
          await conexao`SELECT pg_advisory_unlock(hashtext('pacman-migrate'))`;
          await conexao`RESET lock_timeout`;
        } catch (e) {
          console.error(`[migrate] não consegui liberar o lock: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      conexao.release();
    }
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }

  /** Só para os testes de contrato: esvazia as tabelas. */
  async truncateForTests(): Promise<void> {
    await this.sql`TRUNCATE svg_cache, partidas, dias_sem_jogo`;
  }

  async upsert(p: PartidaNova): Promise<void> {
    await this.sql`
      INSERT INTO partidas (login_key, login, data, pontos, fantasmas, mortes, maior_combo, quadros, celulas,
        eficiencia, interrompida, versao_motor, publicado_sha, snapshot)
      VALUES (${chaveLogin(p.login)}, ${p.login}, ${p.data}, ${p.pontos}, ${p.fantasmas}, ${p.mortes},
        ${p.maior_combo}, ${p.quadros}, ${p.celulas}, ${p.eficiencia}, ${p.interrompida}, ${p.versao_motor},
        ${p.publicado_sha ?? null}, ${p.snapshot === undefined ? null : this.sql.json(p.snapshot)})
      ON CONFLICT (login_key, data) DO UPDATE SET
        login = EXCLUDED.login, pontos = EXCLUDED.pontos, fantasmas = EXCLUDED.fantasmas,
        mortes = EXCLUDED.mortes, maior_combo = EXCLUDED.maior_combo, quadros = EXCLUDED.quadros,
        celulas = EXCLUDED.celulas, eficiencia = EXCLUDED.eficiencia, interrompida = EXCLUDED.interrompida,
        versao_motor = EXCLUDED.versao_motor,
        snapshot = EXCLUDED.snapshot,
        publicado_sha = COALESCE(EXCLUDED.publicado_sha, partidas.publicado_sha)`;
    // Reprocessamento invalida todos os temas dessa partida. A assinatura
    // impede leitura de cache antigo mesmo se outra gravação correr em paralelo.
    await this.sql`DELETE FROM svg_cache WHERE login_key = ${chaveLogin(p.login)} AND data = ${p.data}`;
  }

  async obterSnapshot(login: string, data: string): Promise<ReplaySnapshot | null> {
    const linhas = await this.sql<{ snapshot: ReplaySnapshot | null }[]>`
      SELECT snapshot FROM partidas WHERE login_key = ${chaveLogin(login)} AND data = ${data}`;
    return linhas[0]?.snapshot ?? null;
  }

  async obterSvg(login: string, data: string, tema: string, assinatura: string): Promise<string | null> {
    const rows = await this.sql<{ svg_gzip: Uint8Array }[]>`
      SELECT svg_gzip FROM svg_cache
      WHERE login_key = ${chaveLogin(login)} AND data = ${data}
        AND tema = ${tema} AND assinatura = ${assinatura}
        AND criado_em >= now() - interval '30 days'`;
    if (!rows.length) return null;
    // Uma linha de cache corrompida nunca pode servir SVG estranho nem
    // derrubar a página; a API regenerará a animação verificada.
    try {
      const svg = gunzipSync(Buffer.from(rows[0].svg_gzip), { maxOutputLength: MAX_SVG_BYTES }).toString('utf8');
      return cacheavel(svg) ? svg : null;
    } catch {
      return null;
    }
  }

  async gravarSvg(login: string, data: string, tema: string, assinatura: string, svg: string): Promise<void> {
    if (!cacheavel(svg)) return;
    const comprimido = gzipSync(Buffer.from(svg, 'utf8'), { level: 6 });
    if (comprimido.length > MAX_GZIP_BYTES) return;
    await this.sql`
      INSERT INTO svg_cache (login_key, data, tema, assinatura, svg_gzip)
      VALUES (${chaveLogin(login)}, ${data}, ${tema}, ${assinatura}, ${comprimido})
      ON CONFLICT (login_key, data, tema, assinatura) DO UPDATE SET
        svg_gzip = EXCLUDED.svg_gzip, criado_em = now()`;
    // Limpeza oportunista: 30 dias no cache; partidas e snapshots não mudam.
    await this.sql`DELETE FROM svg_cache WHERE criado_em < now() - ${MAX_CACHE_DAYS} * interval '1 day'`;
  }

  async porJogador(login: string): Promise<PartidaSalva[]> {
    return this.sql<PartidaSalva[]>`
      SELECT ${this.sql.unsafe(COLUNAS)} FROM partidas
      WHERE login_key = ${chaveLogin(login)} ORDER BY data DESC`;
  }

  async entre(de: string, ate: string, logins: string[]): Promise<PartidaSalva[]> {
    if (logins.length === 0) return [];
    return this.sql<PartidaSalva[]>`
      SELECT ${this.sql.unsafe(COLUNAS)} FROM partidas
      WHERE login_key IN ${this.sql(logins.map(chaveLogin))} AND data BETWEEN ${de} AND ${ate}`;
  }

  async todasDe(logins: string[]): Promise<PartidaSalva[]> {
    if (logins.length === 0) return [];
    return this.sql<PartidaSalva[]>`
      SELECT ${this.sql.unsafe(COLUNAS)} FROM partidas WHERE login_key IN ${this.sql(logins.map(chaveLogin))}`;
  }

  async datasExistentes(login: string, versao: string): Promise<Set<string>> {
    const rows = await this.sql<{ data: string }[]>`
      SELECT data::text AS data FROM partidas WHERE login_key = ${chaveLogin(login)} AND versao_motor = ${versao}`;
    return new Set(rows.map((r) => r.data));
  }

  async marcarPublicado(login: string, data: string, sha: string): Promise<void> {
    await this.sql`UPDATE partidas SET publicado_sha = ${sha} WHERE login_key = ${chaveLogin(login)} AND data = ${data}`;
  }

  async marcarSemJogo(login: string, data: string, versao: string): Promise<void> {
    await this.sql`
      INSERT INTO dias_sem_jogo (login_key, data, versao_motor) VALUES (${chaveLogin(login)}, ${data}, ${versao})
      ON CONFLICT (login_key, data) DO UPDATE SET versao_motor = EXCLUDED.versao_motor`;
  }

  async diasSemJogo(login: string, versao: string): Promise<Set<string>> {
    const rows = await this.sql<{ data: string }[]>`
      SELECT data::text AS data FROM dias_sem_jogo WHERE login_key = ${chaveLogin(login)} AND versao_motor = ${versao}`;
    return new Set(rows.map((r) => r.data));
  }
}
