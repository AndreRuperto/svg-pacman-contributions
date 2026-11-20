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
