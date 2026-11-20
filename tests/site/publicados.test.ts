import { describe, it, expect } from 'vitest';
import { listPublished } from '../../site/src/publicados.js';

const commit = (sha: string, date: string) => ({ sha, commit: { committer: { date } } });

type Resposta = { status?: number; body: unknown; link?: string };

function fakeFetch(respostas: Resposta[]) {
  const pedidos: { url: string; init: RequestInit | undefined }[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    pedidos.push({ url: String(url), init });
    const r = respostas.shift();
    if (!r) throw new Error('pedido a mais');
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: r.link ? { link: r.link } : {}
    });
  }) as typeof fetch;
  return { fn, pedidos };
}

describe('listPublished', () => {
  it('monta a URL com cada segmento codificado, autentica e põe timeout', async () => {
    const f = fakeFetch([{ body: [] }]);
    await listPublished('Ana/Ana', 'out put', 'dist/meu svg#1.svg', 'tok', { since: '2026-11-01', fetchImpl: f.fn });
    const { url, init } = f.pedidos[0];
    expect(url).toBe(
      'https://api.github.com/repos/Ana/Ana/commits?sha=out%20put&path=dist/meu%20svg%231.svg&per_page=100&since=2026-11-01T00:00:00Z'
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('data UTC do commit; com vários no mesmo dia, fica o mais recente', async () => {
    const f = fakeFetch([{
      body: [
        commit('c3', '2026-11-20T01:00:00Z'),
        commit('c2', '2026-11-19T23:30:00-03:00'), // = 2026-11-20T02:30Z
        commit('c1', '2026-11-19T10:00:00Z'),
        commit('c0', '2026-11-19T09:00:00Z')
      ]
    }]);
    expect(await listPublished('a/b', 'main', 'x.svg', 't', { fetchImpl: f.fn })).toEqual([
      { date: '2026-11-20', sha: 'c2' },
      { date: '2026-11-19', sha: 'c1' }
    ]);
  });

  it('segue a paginação pelo cabeçalho Link', async () => {
    const next = 'https://api.github.com/repositories/1/commits?sha=main&path=x.svg&per_page=100&page=2';
    const f = fakeFetch([
      { body: [commit('c2', '2026-11-20T10:00:00Z')], link: `<${next}>; rel="next", <${next}>; rel="last"` },
      { body: [commit('c1', '2026-11-18T10:00:00Z')] }
    ]);
    const r = await listPublished('a/b', 'main', 'x.svg', 't', { fetchImpl: f.fn });
    expect(f.pedidos.map((p) => p.url)[1]).toBe(next);
    expect(r).toEqual([{ date: '2026-11-20', sha: 'c2' }, { date: '2026-11-18', sha: 'c1' }]);
  });

  it('não segue um Link para fora da API do GitHub', async () => {
    const f = fakeFetch([{ body: [commit('c1', '2026-11-18T10:00:00Z')], link: '<https://evil.example/x>; rel="next"' }]);
    expect(await listPublished('a/b', 'main', 'x.svg', 't', { fetchImpl: f.fn })).toHaveLength(1);
    expect(f.pedidos).toHaveLength(1);
  });

  it('repositório vazio (409) devolve lista vazia; outros erros viram GITHUB_<status>', async () => {
    expect(await listPublished('a/b', 'main', 'x.svg', 't', { fetchImpl: fakeFetch([{ status: 409, body: {} }]).fn })).toEqual([]);
    await expect(listPublished('a/b', 'main', 'x.svg', 't', { fetchImpl: fakeFetch([{ status: 404, body: {} }]).fn }))
      .rejects.toThrow('GITHUB_404');
  });
});
