import { readFile } from 'node:fs/promises';
import { addDays, dataValida, exigirHoje } from './datas.js';

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
const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const TIMEOUT_MS = 10_000;

function hojeUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function branchValida(s: string): boolean {
  return s.length > 0 && !/\s/.test(s) && !s.includes('..');
}

function pathValido(s: string): boolean {
  return s.length > 0 && !s.startsWith('/') && !/[?#\s"'<>]/.test(s) && !s.split('/').includes('..');
}

function parsePublicado(publicado: unknown, onde: string): Publicado {
  if (!isObject(publicado)) throw new Error(`${onde}: "publicado" deve ser um objeto com repo, branch e path`);
  const { repo, branch, path } = publicado;
  if (typeof repo !== 'string' || !REPO.test(repo)) {
    throw new Error(`${onde}: "publicado.repo" deve ser "dono/repositório" (${JSON.stringify(repo)})`);
  }
  if (typeof branch !== 'string' || !branchValida(branch)) {
    throw new Error(`${onde}: "publicado.branch" deve ser um nome sem espaços nem ".." (${JSON.stringify(branch)})`);
  }
  if (typeof path !== 'string' || !pathValido(path)) {
    throw new Error(
      `${onde}: "publicado.path" deve ser um caminho relativo, sem "..", "?", "#", espaços, aspas nem <> (${JSON.stringify(path)})`
    );
  }
  return { repo, branch, path };
}

/** Valida o conteúdo de `ranking/jogadores.json`. Lança `Error` com mensagem em português. */
export function parseJogadores(json: unknown, hoje = hojeUtc()): Jogador[] {
  exigirHoje(hoje);
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
    if (publicado !== undefined) jogador.publicado = parsePublicado(publicado, onde);
    return jogador;
  });
}

export type LoadOptions =
  | { path: string; hoje?: string }
  | { url: string; fetchImpl?: typeof fetch; hoje?: string };

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Lê a lista de um arquivo local (`path`) ou de uma URL (`url`, com timeout de 10 s). */
export async function loadJogadores(opts: LoadOptions): Promise<Jogador[]> {
  let texto: string;
  if ('path' in opts) {
    try {
      texto = await readFile(opts.path, 'utf8');
    } catch (e) {
      throw new Error(`jogadores.json: não consegui ler (${mensagem(e)})`);
    }
  } else {
    let res: Response;
    try {
      res = await (opts.fetchImpl ?? fetch)(opts.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${opts.url}`);
      texto = await res.text();
    } catch (e) {
      throw new Error(`jogadores.json: não consegui ler (${mensagem(e)})`);
    }
  }
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch (e) {
    throw new Error(`jogadores.json: JSON inválido (${mensagem(e)})`);
  }
  return parseJogadores(json, opts.hoje);
}
