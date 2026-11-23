/** Apoio dos testes de navegador: telas, larguras e rotas externas trocadas por arquivos locais. */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** Mesma data e jogadores de `site/src/fixture.ts`. */
export const HOJE = '2026-11-20';
export const ONTEM = '2026-11-19';

export const TELAS = [
  { nome: 'ranking', url: '/' },
  { nome: 'ranking-eficiencia-7d', url: '/?aba=eficiencia&periodo=7d' },
  { nome: 'perfil', url: '/jogador/ana-arcade' },
  { nome: 'perfil-login-longo', url: '/jogador/bruno-contribuidor-de-login-bem-longo' },
  { nome: 'partida', url: `/jogador/ana-arcade/${ONTEM}` },
  { nome: 'partida-pausada', url: `/jogador/ana-arcade/${ONTEM}?animacao=parada` },
  { nome: 'publicado', url: `/jogador/ana-arcade/${HOJE}/publicado` },
  { nome: 'erro-404', url: '/jogador/ninguem' }
] as const;

export const LARGURAS = [320, 360, 390, 430, 768, 1024, 1440] as const;
/** Larguras de tela que, com zoom de 200%, viram metade em pixels CSS. */
export const LARGURAS_ZOOM = [1024, 1280, 1440] as const;
export const ALTURA = 900;

const AVATAR = readFileSync(new URL('../../site/public/apple-touch-icon.png', import.meta.url));

/**
 * Sem dependência do GitHub: avatares viram o ícone do site e o banner publicado (raw.githubusercontent)
 * vira a animação do próprio servidor de teste. As fontes do Google continuam vindo da rede.
 */
export async function rotasLocais(page: Page, baseURL: string): Promise<void> {
  await page.route(/^https:\/\/github\.com\/.+\.png/, (r) => r.fulfill({ body: AVATAR, contentType: 'image/png' }));
  await page.route(/^https:\/\/raw\.githubusercontent\.com\//, async (r) => {
    const local = await r.fetch({ url: `${baseURL}/api/partida/ana-arcade/${HOJE}?tema=github-dark` });
    await r.fulfill({ response: local });
  });
}

/** Abre a tela e espera as imagens; no perfil, abre a primeira partida da lista. */
export async function abrir(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' });
  const caminho = new URL(url, 'http://local').pathname;
  if (caminho.startsWith('/jogador/') && caminho.split('/').length === 3) {
    const primeira = page.locator('details.partida').first();
    if (await primeira.count()) await primeira.locator('summary').click();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete || img.loading === 'lazy' || !img.checkVisibility())
  );
}

export async function axe(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return r.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    alvos: v.nodes.slice(0, 5).map((n) => n.target.join(' '))
  }));
}

/** Elementos que passam da borda direita da janela (fora das áreas de rolagem horizontal intencionais). */
export async function overflow(page: Page) {
  return page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const rolagem = document.documentElement.scrollWidth;
    const dentroDeRolagem = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      }
      return false;
    };
    const fora = [...document.body.querySelectorAll('*')]
      .filter((el) => el.checkVisibility() && !el.closest('.sr'))
      .filter((el) => el.getBoundingClientRect().right > largura + 0.5 && !dentroDeRolagem(el))
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''} (${Math.round(el.getBoundingClientRect().right)}px)`);
    return { largura, rolagem, fora };
  });
}

/** Percorre a página com Tab e devolve, para cada parada, se o foco aparece e está na tela. */
export async function percorrerFoco(page: Page, maximo = 80) {
  const paradas: { alvo: string; visivel: boolean; naTela: boolean; motivo: string }[] = [];
  await focoNoInicio(page);
  for (let i = 0; i < maximo; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const largura = parseFloat(cs.outlineWidth);
      const temContorno = cs.outlineStyle !== 'none' && largura >= 2;
      const temSombra = cs.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      const naTela = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
        r.top < innerHeight && r.left < innerWidth;
      const texto = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return {
        alvo: `${el.tagName.toLowerCase()} "${texto}"`,
        visivel: temContorno || temSombra,
        naTela,
        motivo: `outline ${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`
      };
    });
    if (!info) break;
    if (paradas.length && paradas[0].alvo === info.alvo) break;
    paradas.push(info);
  }
  return paradas;
}

/** Volta o ponto de partida do Tab para o começo da página (um clique anterior o muda). */
export async function focoNoInicio(page: Page): Promise<void> {
  await page.evaluate(() => {
    scrollTo(0, 0);
    const b = document.body;
    b.setAttribute('tabindex', '-1');
    b.focus();
    b.removeAttribute('tabindex');
  });
}
