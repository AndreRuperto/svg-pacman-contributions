import { describe, it, expect } from 'vitest';
import { createApp, type AppDeps } from '../../site/src/app.js';
import { addDays } from '../../site/src/datas.js';
import { RateLimiter } from '../../site/src/ratelimit.js';
import { MemoryRepo } from '../../site/src/repo.js';
import type { Jogador } from '../../site/src/jogadores.js';
import type { Partida } from '../../src/runner.js';

const HOJE = '2026-11-20';
const EDITAR = 'https://github.com/AndreRuperto/svg-pacman-contributions/edit/main/ranking/jogadores.json';
const RAW = 'https://raw.githubusercontent.com/AndreRuperto/AndreRuperto/abc/dist/pacman-contribution-graph-dark.svg';

const p = (login: string, data: string, pontos: number, extra: Partial<Partida> = {}): Partida => ({
  login, data, pontos, fantasmas: 2, mortes: 1, maior_combo: 3, quadros: 905, celulas: 100,
  eficiencia: pontos / 100, interrompida: false, versao_motor: '1.1.0', ...extra
});

const jogadores: Jogador[] = [
  { login: 'AndreRuperto', desde: '2026-01-01', publicado: { repo: 'AndreRuperto/AndreRuperto', branch: 'output', path: 'dist/pacman-contribution-graph-dark.svg' } },
  { login: 'bia', desde: '2026-01-01' }
];

async function montar(opts: { lista?: Jogador[]; partidas?: Partida[]; deps?: Partial<AppDeps> } = {}) {
  const repo = new MemoryRepo();
  const partidas = opts.partidas ?? [
    p('AndreRuperto', HOJE, 900, { eficiencia: 3 }),
    p('bia', HOJE, 1200, { eficiencia: 2, fantasmas: 1, mortes: 5 }),
    p('AndreRuperto', '2026-11-19', 5000, { interrompida: true }),
    p('AndreRuperto', '2026-11-15', 2000)
  ];
  for (const x of partidas) await repo.upsert(x);
  if (!opts.partidas) await repo.marcarPublicado('AndreRuperto', HOJE, 'abc');
  const lista = opts.lista ?? jogadores;
  const app = createApp({
    repo,
    jogadores: () => lista,
    hoje: () => HOJE,
    renderSvg: async () => '<svg/>',
    ...opts.deps
  });
  return { app, repo };
}

async function pagina(app: Awaited<ReturnType<typeof montar>>['app'], url: string) {
  const res = await app.request(url);
  return { res, html: await res.text() };
}

/** A tag `<a …>` cujo texto é `texto`. */
function link(html: string, texto: string): string | undefined {
  const m = html.match(new RegExp(`<a\\b[^>]*>\\s*${texto}\\s*</a>`));
  return m?.[0];
}

describe('layout', () => {
  it('pt-BR, viewport, título e CSS versionado', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, '/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toMatch(/<title>Ranking · SVG Pac-Man<\/title>/);
    expect(html).toMatch(/href="\/static\/site\.css\?v=[0-9a-f]{8,}"/);
    expect(html).toContain('fonts.googleapis.com');
  });

  it('serve o CSS com cache longo', async () => {
    const { app } = await montar();
    const res = await app.request('/static/site.css');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/css/);
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.text()).toContain('#FFD23F');
    expect((await app.request('/static/outro.css')).status).toBe(404);
  });

  it('rota desconhecida fora da API devolve uma página HTML 404', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, '/nada/aqui');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(html).toContain('Página não encontrada');
    expect(html).toContain('href="/"');
    const api = await app.request('/api/nada');
    expect(api.status).toBe(404);
    expect(api.headers.get('content-type')).toMatch(/json/);
  });
});

describe('logo e favicon', () => {
  it('/favicon.ico devolve o PNG da logo sem passar pelo limite', async () => {
    const { app } = await montar({ deps: { rateLimiterJson: new RateLimiter({ limite: 0, janelaMs: 60_000 }) } });
    const res = await app.request('/favicon.ico');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]); // assinatura PNG
    expect((await app.request('/')).status).toBe(429);
  });

  it('serve logo.svg, os PNGs e a prévia com cache longo', async () => {
    const { app } = await montar();
    const tipos: Record<string, string> = {
      '/static/logo.svg': 'image/svg+xml',
      '/static/favicon-32.png': 'image/png',
      '/static/apple-touch-icon.png': 'image/png',
      '/static/og.png': 'image/png'
    };
    for (const [url, tipo] of Object.entries(tipos)) {
      const res = await app.request(url);
      expect(res.status, url).toBe(200);
      expect(res.headers.get('content-type'), url).toBe(tipo);
      expect(res.headers.get('cache-control'), url).toContain('immutable');
    }
    expect((await app.request('/static/nao-existe.png')).status).toBe(404);
  });

  it('o layout tem favicon, ícone de tela inicial, prévia de link e a logo no cabeçalho', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/static\/logo\.svg\?v=[0-9a-f]{12}">/);
    expect(html).toMatch(/<link rel="icon" type="image\/png" sizes="32x32" href="\/static\/favicon-32\.png\?v=[0-9a-f]{12}">/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/static\/apple-touch-icon\.png\?v=[0-9a-f]{12}">/);
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/svg-pacman-ranking\.up\.railway\.app\/static\/og\.png\?v=[0-9a-f]{12}">/);
    expect(html).toMatch(/<meta property="og:title" content="Ranking · SVG Pac-Man">/);
    expect(html).toMatch(/<a class="marca" href="\/"><img src="\/static\/logo\.svg\?v=[0-9a-f]{12}" alt="" width="28" height="28">SVG Pac-Man<\/a>/);
  });
});

describe('GET /', () => {
  it('abas e períodos são links com aria-current no ativo', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/');
    expect(link(html, 'Pontos')).toContain('href="/?aba=pontos&amp;periodo=hoje"');
    expect(link(html, 'Pontos')).toContain('aria-current="page"');
    expect(link(html, 'Eficiência')).toContain('href="/?aba=eficiencia&amp;periodo=hoje"');
    expect(link(html, 'Eficiência')).not.toContain('aria-current');
    expect(link(html, 'Último dia')).toContain('aria-current="page"');
    expect(link(html, '7 dias')).toContain('href="/?aba=pontos&amp;periodo=7d"');
    expect(link(html, 'Recorde')).not.toContain('aria-current');

    const ef = (await pagina(app, '/?aba=eficiencia&periodo=recorde')).html;
    expect(link(ef, 'Eficiência')).toContain('aria-current="page"');
    expect(link(ef, 'Recorde')).toContain('aria-current="page"');
    expect(link(ef, '7 dias')).toContain('href="/?aba=eficiencia&amp;periodo=7d"');
  });

  it('o período "hoje" aparece como "Último dia" com a data, nunca "Hoje"', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/?periodo=hoje');
    expect(html).toContain('Último dia · 20 nov. 2026');
    expect(html).not.toMatch(/>\s*Hoje\b/);
  });

  it('tabela com th scope="col", linhas na ordem e avatar', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/');
    expect(html).toContain('<th scope="col">');
    expect(html).toMatch(/<th scope="row"[^>]*><a class="jogador" href="\/jogador\/bia"/);
    expect(html.indexOf('href="/jogador/bia"')).toBeLessThan(html.indexOf('href="/jogador/AndreRuperto"'));
    expect(html).toContain('https://github.com/bia.png?size=56');
    expect(html).toContain('1 fantasma · 5 mortes · 3m 01s');
  });

  it('link "Como entrar" aponta para a edição da lista', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/');
    expect(link(html, 'Como entrar')).toContain(`href="${EDITAR}"`);
    expect(html).toContain('Quer entrar no ranking?');
  });

  it('estado vazio', async () => {
    const { app } = await montar({ partidas: [] });
    const { html } = await pagina(app, '/');
    expect(html).toContain('Ainda não há partidas para este período.');
    expect(html).not.toContain('<table');
  });

  it('aba ou período inválidos caem no padrão', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, '/?aba=xyz&periodo=ontem');
    expect(res.status).toBe(200);
    expect(link(html, 'Pontos')).toContain('aria-current="page"');
  });

  it('escapa o login', async () => {
    const lista: Jogador[] = [{ login: '<script>alert(1)</script>', desde: '2026-01-01' }];
    const { app } = await montar({ lista, partidas: [p('<script>alert(1)</script>', HOJE, 10)] });
    const { html } = await pagina(app, '/');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('GET /jogador/:login', () => {
  it('gráfico acessível com polyline', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, '/jogador/AndreRuperto');
    expect(res.status).toBe(200);
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Pontos por dia, de 1 jan\. 2026 a 20 nov\. 2026"/);
    expect(html).toContain('Média de todas as partidas');
    expect(html).toContain('<polyline');
    expect(html).toMatch(/<h1[^>]*>AndreRuperto<\/h1>/);
    expect(html).toContain('no ranking desde 1 jan. 2026 · 3 partidas');
  });

  it('grade com valores inteiros, linha quebrada onde faltam dias e resumo para leitor de tela', async () => {
    const { app } = await montar({
      partidas: [
        p('bia', HOJE, 1203),
        p('bia', addDays(HOJE, -1), 900),
        p('bia', addDays(HOJE, -5), 333),
        p('bia', addDays(HOJE, -6), 400)
      ]
    });
    const { html } = await pagina(app, '/jogador/bia');
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    expect(svg.match(/<polyline/g)).toHaveLength(2);
    const rotulos = [...svg.matchAll(/<text[^>]*text-anchor="end">([\d.]+)<\/text>/g)].map((m) => Number(m[1].replace(/\./g, '')));
    expect(rotulos).toHaveLength(5);
    for (const r of rotulos) expect(Number.isInteger(r)).toBe(true);
    expect(Math.max(...rotulos) % 4).toBe(0);
    expect(html).toMatch(/<p class="sr">[^<]*Maior: 1\.203 em 20 nov\. 2026[^<]*menor: 333 em 15 nov\. 2026[^<]*último: 1\.203 em 20 nov\. 2026/);
  });

  it('histórico inteiro: com muitas partidas o gráfico vira só linha, sem os pontos', async () => {
    const partidas = Array.from({ length: 120 }, (_, i) => p('bia', addDays(HOJE, -i), 100 + i));
    const { app } = await montar({ partidas });
    const { html } = await pagina(app, '/jogador/bia');
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    expect(svg.match(/<polyline/g)).toHaveLength(1);
    expect(svg).not.toContain('<circle');
    const pts = svg.match(/points="([^"]*)"/)![1].trim().split(' ');
    expect(pts).toHaveLength(120);
  });

  it('cada partida abre na própria lista: seta para baixo, animação sob demanda e link da página do dia', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/jogador/andreruperto');
    expect(html).not.toContain('Ver a partida');
    const itens = [...html.matchAll(/<details class="partida"[\s\S]*?<\/details>/g)].map((m) => m[0]);
    expect(itens).toHaveLength(3);
    const primeiro = itens[0];
    // resumo clicável com data, pontos e a seta
    expect(primeiro).toMatch(/<summary[^>]*>[\s\S]*20 nov\. 2026[\s\S]*<svg class="seta-abrir"[^>]*aria-hidden="true"/);
    // a animação só carrega ao abrir (lazy) e tem texto alternativo
    expect(primeiro).toMatch(/<img[^>]*src="\/api\/partida\/AndreRuperto\/2026-11-20\?tema=github-dark"[^>]*loading="lazy"/);
    expect(primeiro).toMatch(/alt="Partida de AndreRuperto em 20 nov\. 2026"/);
    for (const d of [HOJE, '2026-11-19', '2026-11-15']) expect(html).toContain(`href="/jogador/AndreRuperto/${d}"`);
    // nenhum item vem aberto
    expect(html).not.toMatch(/<details class="partida"[^>]*\bopen\b/);
  });

  it('sem animação no servidor, a partida aberta mostra o aviso no lugar da imagem', async () => {
    const { app } = await montar({ deps: { podeDesenhar: false } });
    const { html } = await pagina(app, '/jogador/AndreRuperto');
    const primeiro = html.match(/<details class="partida"[\s\S]*?<\/details>/)![0];
    expect(primeiro).not.toContain('<img');
    expect(primeiro).toContain('A animação não está disponível neste servidor.');
  });

  it('"Ver como foi publicado" só quando existe publicado_sha', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, '/jogador/AndreRuperto');
    // o link abre uma página do site: o raw do GitHub bloqueia as imagens embutidas no SVG antigo
    expect(html).not.toContain(RAW);
    expect(link(html, 'Ver como foi publicado')).toContain(`href="/jogador/AndreRuperto/${HOJE}/publicado"`);
    const bia = (await pagina(app, '/jogador/bia')).html;
    expect(bia).not.toContain('raw.githubusercontent.com');
  });

  it('pagina a lista de 30 em 30', async () => {
    const partidas = Array.from({ length: 35 }, (_, i) => p('bia', addDays(HOJE, -i), 100 + i));
    const { app } = await montar({ partidas });
    const um = (await pagina(app, '/jogador/bia')).html;
    expect(um).toContain('href="/jogador/bia?pagina=2"');
    expect(um).toContain(`href="/jogador/bia/${addDays(HOJE, -29)}"`);
    expect(um).not.toContain(`href="/jogador/bia/${addDays(HOJE, -30)}"`);
    const dois = (await pagina(app, '/jogador/bia?pagina=2')).html;
    expect(dois).toContain(`href="/jogador/bia/${addDays(HOJE, -34)}"`);
    expect(dois).not.toContain(`href="/jogador/bia/${HOJE}"`);
    expect(dois).not.toContain('pagina=3');
    expect(dois).toContain('href="/jogador/bia"');
  });

  it('sem paginação com até 30 partidas', async () => {
    const { app } = await montar();
    expect((await pagina(app, '/jogador/AndreRuperto')).html).not.toContain('pagina=');
  });

  it('fora da lista → 404 em HTML', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, '/jogador/fulano');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(html).toContain('fulano');
  });
});

describe('GET /jogador/:login/:data', () => {
  it('imagem da partida no tema padrão', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, `/jogador/AndreRuperto/${HOJE}`);
    expect(res.status).toBe(200);
    expect(html).toContain(
      `<img src="/api/partida/AndreRuperto/${HOJE}?tema=github-dark" alt="Partida de AndreRuperto em 20 nov. 2026"`
    );
    expect(html).toContain('width="1166" height="229"');
  });

  it('formulário GET com label e os 8 temas', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, `/jogador/AndreRuperto/${HOJE}?tema=neon`);
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toContain('<label for="tema">Tema da animação</label>');
    expect(html).toContain('<select id="tema" name="tema">');
    expect(html.match(/<option /g)).toHaveLength(8);
    expect(html).toMatch(/<option value="neon" selected>/);
    expect(html).toContain(`src="/api/partida/AndreRuperto/${HOJE}?tema=neon"`);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Mudar<\/button>/);
  });

  it('tema inválido cai no padrão', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, `/jogador/AndreRuperto/${HOJE}?tema=xyz`);
    expect(html).toContain(`?tema=github-dark"`);
  });

  it('página "como foi publicado": mostra o SVG antigo como <img> (assim as imagens embutidas aparecem)', async () => {
    const { app } = await montar();
    const { res, html } = await pagina(app, `/jogador/AndreRuperto/${HOJE}/publicado`);
    expect(res.status).toBe(200);
    const img = html.match(/<img[^>]*class="partida-svg"[^>]*>/)![0];
    expect(img).toContain(`src="${RAW}"`);
    expect(img).toContain('alt="Banner publicado no perfil de AndreRuperto em 20 nov. 2026"');
    expect(html).toContain(`href="/jogador/AndreRuperto/${HOJE}"`);
    expect(link(html, 'Abrir o arquivo original')).toContain(`href="${RAW}"`);
    expect(res.headers.get('content-security-policy')).toContain('https://raw.githubusercontent.com');
  });

  it('página "como foi publicado" dá 404 quando o dia não tem SVG publicado', async () => {
    const { app } = await montar();
    expect((await pagina(app, '/jogador/AndreRuperto/2026-11-15/publicado')).res.status).toBe(404);
    expect((await pagina(app, '/jogador/bia/2026-11-20/publicado')).res.status).toBe(404);
  });

  it('dia anterior e seguinte com aria-label', async () => {
    const { app } = await montar();
    const meio = (await pagina(app, '/jogador/AndreRuperto/2026-11-19')).html;
    expect(meio).toMatch(/<a [^>]*href="\/jogador\/AndreRuperto\/2026-11-15"[^>]*aria-label="Dia anterior, 15 nov\. 2026"/);
    expect(meio).toMatch(/<a [^>]*href="\/jogador\/AndreRuperto\/2026-11-20"[^>]*aria-label="Dia seguinte, 20 nov\. 2026"/);
    expect(meio).toContain('<h1><span class="sr">AndreRuperto, </span>19 nov. 2026</h1>');
    const ultimo = (await pagina(app, `/jogador/AndreRuperto/${HOJE}`)).html;
    expect(ultimo).not.toMatch(/<a [^>]*aria-label="Dia seguinte/);
    expect(ultimo).toMatch(/<a [^>]*aria-label="Dia anterior, 19 nov\. 2026"/);
  });

  it('sem como desenhar, troca a imagem por um aviso', async () => {
    const { app } = await montar({ deps: { podeDesenhar: false } });
    const { res, html } = await pagina(app, `/jogador/AndreRuperto/${HOJE}`);
    expect(res.status).toBe(200);
    expect(html).not.toContain('/api/partida/');
    expect(html).toContain('A animação não está disponível neste servidor.');
    expect(html).toContain('Pontos');
  });

  it('placar e link do publicado', async () => {
    const { app } = await montar();
    const { html } = await pagina(app, `/jogador/AndreRuperto/${HOJE}`);
    expect(html).toContain('×3');
    expect(html).toContain('3m 01s');
    expect(link(html, 'Ver como foi publicado neste dia')).toContain(`href="/jogador/AndreRuperto/${HOJE}/publicado"`);
    const sem = (await pagina(app, '/jogador/AndreRuperto/2026-11-15')).html;
    expect(sem).not.toContain('raw.githubusercontent.com');
  });

  it('404 sem partida, data inválida ou jogador fora da lista', async () => {
    const { app } = await montar();
    for (const url of ['/jogador/AndreRuperto/2026-11-01', '/jogador/AndreRuperto/2026-13-01', `/jogador/fulano/${HOJE}`]) {
      const res = await app.request(url);
      expect(res.status, url).toBe(404);
      expect(res.headers.get('content-type')).toMatch(/text\/html/);
    }
  });
});
