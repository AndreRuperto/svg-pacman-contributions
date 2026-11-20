import { readFile } from 'node:fs/promises';
import { addDays } from './ranking.js';

export interface Publicado {
  repo: string;
  branch: string;
  path: string;
}

export interface Jogador {
  login: string;
  /** AAAA-MM-DD (UTC): primeiro dia que o cron joga. */
  desde: string;
  publicado?: Publicado;
}

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function hojeUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function dataValida(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Valida o conteúdo de `ranking/jogadores.json`. Lança `Error` com mensagem em português. */
export function parseJogadores(json: unknown, hoje = hojeUtc()): Jogador[] {
  if (!isObject(json) || !Array.isArray(json.jogadores)) {
    throw new Error('jogadores.json: esperado um objeto com a lista "jogadores"');
  }
  const vistos = new Set<string>();
  return json.jogadores.map((item: unknown, i: number): Jogador => {
    const onde = `jogadores[${i}]`;
    if (!isObject(item)) throw new Error(`${onde}: esperado um objeto`);
    const { login, desde, publicado } = item;
    if (typeof login !== 'string' || !LOGIN.test(login)) {
      throw new Error(`${onde}: login inválido (${JSON.stringify(login)})`);
    }
    const chave = login.toLowerCase();
    if (vistos.has(chave)) throw new Error(`${onde}: login duplicado (${login})`);
    vistos.add(chave);
    if (desde !== undefined && !dataValida(desde)) {
      throw new Error(`${onde}: "desde" deve ser uma data AAAA-MM-DD válida (${JSON.stringify(desde)})`);
    }
    const jogador: Jogador = { login, desde: desde ?? addDays(hoje, -364) };
    if (publicado !== undefined) {
      if (!isObject(publicado) || !['repo', 'branch', 'path'].every((k) => typeof publicado[k] === 'string')) {
        throw new Error(`${onde}: "publicado" precisa de repo, branch e path (textos)`);
      }
      jogador.publicado = { repo: publicado.repo as string, branch: publicado.branch as string, path: publicado.path as string };
    }
    return jogador;
  });
}

export type LoadOptions =
  | { path: string; hoje?: string }
  | { url: string; fetchImpl?: typeof fetch; hoje?: string };

/** Lê a lista de um arquivo local (`path`) ou de uma URL (`url`). */
export async function loadJogadores(opts: LoadOptions): Promise<Jogador[]> {
  let texto: string;
  if ('path' in opts) {
    texto = await readFile(opts.path, 'utf8');
  } else {
    const res = await (opts.fetchImpl ?? fetch)(opts.url);
    if (!res.ok) throw new Error(`jogadores.json: falha ao buscar ${opts.url} (HTTP ${res.status})`);
    texto = await res.text();
  }
  return parseJogadores(JSON.parse(texto), opts.hoje);
}
