import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseJogadores, loadJogadores } from '../../site/src/jogadores.js';

const arquivo = JSON.parse(readFileSync('ranking/jogadores.json', 'utf8'));
const hoje = '2026-11-20';

describe('parseJogadores', () => {
  it('aceita o arquivo do repositório', () => {
    const [j] = parseJogadores(arquivo, hoje);
    expect(j.login).toBe('AndreRuperto');
    expect(j.desde).toBe('2025-04-08');
    expect(j.publicado).toEqual({ repo: 'AndreRuperto/AndreRuperto', branch: 'output', path: 'dist/pacman-contribution-graph-dark.svg' });
  });
  it('recusa login inválido, dizendo o índice', () => {
    expect(() => parseJogadores({ jogadores: [{ login: 'ok' }, { login: '-ruim' }] }, hoje)).toThrow(/jogadores\[1\]/);
  });
  it('recusa logins duplicados sem diferenciar maiúsculas', () => {
    expect(() => parseJogadores({ jogadores: [{ login: 'Ana' }, { login: 'ana' }] }, hoje)).toThrow(/duplicado/);
  });
  it('sem desde nem publicado, desde = hoje − 364', () => {
    expect(parseJogadores({ jogadores: [{ login: 'ana' }] }, hoje)).toEqual([{ login: 'ana', desde: '2025-11-21' }]);
  });
  it('recusa desde com data inválida', () => {
    expect(() => parseJogadores({ jogadores: [{ login: 'ana', desde: '2026-13-01' }] }, hoje)).toThrow(/desde/);
    expect(() => parseJogadores({ jogadores: [{ login: 'ana', desde: '20/11/2026' }] }, hoje)).toThrow(/desde/);
  });
});

describe('loadJogadores', () => {
  it('lê o arquivo local', async () => {
    const lista = await loadJogadores({ path: 'ranking/jogadores.json', hoje });
    expect(lista.map((j) => j.login)).toEqual(['AndreRuperto']);
  });
  it('busca por URL', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ jogadores: [{ login: 'bia' }] }))) as typeof fetch;
    const lista = await loadJogadores({ url: 'https://exemplo/jogadores.json', fetchImpl, hoje });
    expect(lista.map((j) => j.login)).toEqual(['bia']);
  });
  it('falha se a URL responder com erro', async () => {
    const fetchImpl = (async () => new Response('não', { status: 404 })) as typeof fetch;
    await expect(loadJogadores({ url: 'https://exemplo/x', fetchImpl, hoje })).rejects.toThrow(/404/);
  });
});

describe('parseJogadores — publicado', () => {
  const ok = { repo: 'ana/ana.github.io', branch: 'output', path: 'dist/pacman.svg' };
  const com = (publicado: unknown) => ({ jogadores: [{ login: 'ok' }, { login: 'ana', publicado }] });

  it('aceita um publicado válido', () => {
    expect(parseJogadores(com(ok), hoje)[1].publicado).toEqual(ok);
  });
  it.each([
    ['repo sem dono', { ...ok, repo: 'ana' }, /repo/],
    ['repo com caminho extra', { ...ok, repo: 'ana/x/y' }, /repo/],
    ['repo com espaço', { ...ok, repo: 'ana/meu repo' }, /repo/],
    ['branch vazia', { ...ok, branch: '' }, /branch/],
    ['branch com espaço', { ...ok, branch: 'a b' }, /branch/],
    ['branch com ..', { ...ok, branch: 'a..b' }, /branch/],
    ['path vazio', { ...ok, path: '' }, /path/],
    ['path absoluto', { ...ok, path: '/dist/x.svg' }, /path/],
    ['path com ..', { ...ok, path: 'dist/../x.svg' }, /path/],
    ['path com ?', { ...ok, path: 'x.svg?a=1' }, /path/],
    ['path com #', { ...ok, path: 'x.svg#a' }, /path/],
    ['path com espaço', { ...ok, path: 'meu x.svg' }, /path/],
    ['path com aspas', { ...ok, path: 'x".svg' }, /path/],
    ['path com <>', { ...ok, path: '<x>.svg' }, /path/],
    ['campo faltando', { repo: ok.repo, branch: ok.branch }, /path/],
    ['não é objeto', 'ana/ana', /publicado/]
  ])('recusa %s, dizendo o índice', (_nome, publicado, campo) => {
    expect(() => parseJogadores(com(publicado), hoje)).toThrow(/jogadores\[1\]/);
    expect(() => parseJogadores(com(publicado), hoje)).toThrow(campo);
  });
  it('recusa hoje inválido', () => {
    expect(() => parseJogadores({ jogadores: [] }, '2026-02-30')).toThrow(/hoje/);
  });
});

describe('loadJogadores — erros', () => {
  it('passa um signal de timeout ao fetch', async () => {
    let init: RequestInit | undefined;
    const fetchImpl = (async (_u: unknown, i?: RequestInit) => { init = i; return new Response('{"jogadores":[]}'); }) as typeof fetch;
    await loadJogadores({ url: 'https://exemplo/x', fetchImpl, hoje });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('JSON inválido vira erro claro', async () => {
    const fetchImpl = (async () => new Response('{nope')) as typeof fetch;
    await expect(loadJogadores({ url: 'https://exemplo/x', fetchImpl, hoje })).rejects.toThrow(/^jogadores\.json: JSON inválido \(/);
  });
  it('arquivo ausente vira erro claro', async () => {
    await expect(loadJogadores({ path: 'ranking/nao-existe.json', hoje })).rejects.toThrow(/^jogadores\.json: não consegui ler \(/);
  });
});
