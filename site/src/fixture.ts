/**
 * Dados fixos para o modo de teste do site (Playwright/axe e capturas de tela).
 * Nada aqui vai à rede: as contribuições são geradas por uma semente e as partidas
 * são jogadas pelo motor de verdade, gravadas num `MemoryRepo` como o cron faria.
 */
import { playDay } from '../../src/runner.js';
import type { Contribution, ContributionLevel, ThemeKeys } from '../../src/types.js';
import { gridWindow } from '../../src/utils/utils.js';
import { createApp } from './app.js';
import { runCron } from './cron.js';
import { addDays } from './datas.js';
import type { Jogador } from './jogadores.js';
import { MemoryRepo, type PartidaSalva } from './repo.js';
import { recuperarSnapshot } from './snapshot.js';
import { validarReplay } from './web.js';

/** O "último dia completo" congelado do modo de teste. */
export const HOJE_FIXTURE = '2026-11-20';

/** SHA fictício do banner publicado (a URL do raw é interceptada pelos testes). */
export const SHA_FIXTURE = 'f1x7u4e0000000000000000000000000000000a1';

/** Três jogadores: um com banner publicado, um com login longo (teste de quebra de linha) e um recente. */
export const JOGADORES_FIXTURE: Jogador[] = [
  {
    login: 'ana-arcade',
    desde: addDays(HOJE_FIXTURE, -9),
    publicado: { repo: 'ana-arcade/ana-arcade', branch: 'output', path: 'dist/pacman.svg' }
  },
  { login: 'bruno-contribuidor-de-login-bem-longo', desde: addDays(HOJE_FIXTURE, -4) },
  { login: 'carla', desde: addDays(HOJE_FIXTURE, -2) }
];

/** Gerador pseudoaleatório pequeno (mulberry32), para o calendário não depender do relógio. */
function rng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const NIVEIS: ContributionLevel[] = ['FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];

/** Janela de contribuições de `login` terminando em `data`, esparsa (≈12% dos dias) para o jogo ser rápido. */
export function janelaFixture(login: string, data: string): Contribution[] {
  const inicio = gridWindow(data).start.toISOString().slice(0, 10);
  const contribuicoes: Contribution[] = [];
  for (let d = inicio; d <= data; d = addDays(d, 1)) {
    const r = rng(hash(`${login}|${d}`))();
    const ativo = r < 0.12;
    const nivel = Math.min(3, Math.floor(r * 33));
    contribuicoes.push({
      date: new Date(`${d}T00:00:00Z`),
      count: ativo ? nivel * 3 + 1 : 0,
      color: '',
      level: ativo ? NIVEIS[nivel] : 'NONE'
    });
  }
  return contribuicoes;
}

/** Joga os dias dos jogadores fixos e devolve o repositório preenchido. */
export async function montarRepoFixture(): Promise<MemoryRepo> {
  const repo = new MemoryRepo();
  await runCron({
    repo,
    jogadores: JOGADORES_FIXTURE,
    ultimo: HOJE_FIXTURE,
    agora: new Date(`${addDays(HOJE_FIXTURE, 1)}T12:00:00Z`),
    fetchWindow: async (login, data) => ({ contributions: janelaFixture(login, data), rateLimit: null })
  });
  // O banner publicado de dois dias da ana (a página /publicado precisa do sha).
  for (const data of [HOJE_FIXTURE, addDays(HOJE_FIXTURE, -1)]) {
    await repo.marcarPublicado('ana-arcade', data, SHA_FIXTURE);
  }
  return repo;
}

/** App do site em modo de teste: memória, dados fixos, replay pelo snapshot, sem rede e sem limite apertado. */
export async function criarAppFixture() {
  const repo = await montarRepoFixture();
  const { RateLimiter } = await import('./ratelimit.js');
  const folgado = () => new RateLimiter({ limite: 100_000, janelaMs: 60_000 });
  return createApp({
    repo,
    jogadores: () => JOGADORES_FIXTURE,
    hoje: () => HOJE_FIXTURE,
    rateLimiter: folgado(),
    rateLimiterJson: folgado(),
    renderSvg: async (login: string, data: string, tema: ThemeKeys, salva: PartidaSalva, snapshot) => {
      if (snapshot === null) return null;
      const partida = await playDay({ login, date: data, contributions: recuperarSnapshot(snapshot), theme: tema, withSvg: true });
      validarReplay(salva, partida);
      return partida?.svg ?? null;
    }
  });
}
