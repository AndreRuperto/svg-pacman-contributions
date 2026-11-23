/**
 * Capturas de tela reais da V4 (QA de acessibilidade), a partir do servidor de teste com dados fixos.
 *   PORT=3457 pnpm site:teste      (em outro terminal)
 *   pnpm qa:capturas               (grava em docs/design/qa-v4/)
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';
import { ALTURA, HOJE, LARGURAS, LARGURAS_ZOOM, ONTEM, abrir, focoNoInicio, rotasLocais } from './apoio';

const BASE = process.env.BASE_URL ?? 'http://localhost:3457';
const SAIDA = new URL('../../docs/design/qa-v4/', import.meta.url);

const TELAS = [
  { nome: 'ranking', url: '/' },
  { nome: 'perfil', url: '/jogador/ana-arcade' },
  { nome: 'partida', url: `/jogador/ana-arcade/${ONTEM}` },
  { nome: 'publicado', url: `/jogador/ana-arcade/${HOJE}/publicado` }
];

async function pagina(navegador: Browser, largura: number, altura: number, escala = 1, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: escala, locale: 'pt-BR', reducedMotion });
  const page = await ctx.newPage();
  await rotasLocais(page, BASE);
  return { ctx, page };
}

async function salvar(page: Page, arquivo: string, inteira = true) {
  await page.screenshot({ path: new URL(arquivo, SAIDA).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: inteira, type: 'jpeg', quality: 78 });
  console.log(arquivo);
}

const navegador = await chromium.launch();
mkdirSync(SAIDA, { recursive: true });

for (const tela of TELAS) {
  for (const largura of LARGURAS) {
    const { ctx, page } = await pagina(navegador, largura, ALTURA);
    await abrir(page, BASE + tela.url);
    await salvar(page, `${tela.nome}-${largura}.jpg`);
    await ctx.close();
  }
  for (const largura of LARGURAS_ZOOM) {
    const { ctx, page } = await pagina(navegador, largura / 2, ALTURA / 2, 2);
    await abrir(page, BASE + tela.url);
    await salvar(page, `${tela.nome}-${largura}-zoom200.jpg`);
    await ctx.close();
  }
}

// Movimento reduzido: a arena não toca sozinha.
for (const largura of [390, 1440]) {
  for (const tela of TELAS.filter((t) => t.nome === 'partida' || t.nome === 'publicado')) {
    const { ctx, page } = await pagina(navegador, largura, ALTURA, 1, 'reduce');
    await abrir(page, BASE + tela.url);
    await salvar(page, `${tela.nome}-${largura}-movimento-reduzido.jpg`);
    await ctx.close();
  }
}

// Foco visível: uma parada de Tab em cada tela (só a janela visível).
const focos = [
  { nome: 'ranking', url: '/', tabs: 6 },
  { nome: 'perfil', url: '/jogador/ana-arcade', tabs: 9 },
  { nome: 'partida', url: `/jogador/ana-arcade/${ONTEM}`, tabs: 7 }
];
for (const largura of [390, 1440]) {
  for (const f of focos) {
    const { ctx, page } = await pagina(navegador, largura, ALTURA);
    await page.goto(BASE + f.url);
    await page.evaluate(() => document.fonts.ready);
    await focoNoInicio(page);
    for (let i = 0; i < f.tabs; i++) await page.keyboard.press('Tab');
    await salvar(page, `${f.nome}-${largura}-foco.jpg`, false);
    await ctx.close();
  }
}

await navegador.close();
