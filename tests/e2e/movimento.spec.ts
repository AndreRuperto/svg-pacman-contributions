/** prefers-reduced-motion: o CSS não anima, e a animação SMIL da arena só toca quando a pessoa pede. */
import { expect, test, type Page } from '@playwright/test';
import { HOJE, ONTEM, TELAS, abrir, rotasLocais } from './apoio';

const PARTIDA = `/jogador/ana-arcade/${ONTEM}`;
const PUBLICADO = `/jogador/ana-arcade/${HOJE}/publicado`;

/** A imagem mudou entre dois instantes? (a animação SMIL está tocando) */
async function anima(page: Page, seletor: string): Promise<boolean> {
  const img = page.locator(seletor);
  await page.waitForTimeout(600);
  const a = await img.screenshot();
  await page.waitForTimeout(1500);
  return !a.equals(await img.screenshot());
}

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(async ({ page, baseURL }) => rotasLocais(page, baseURL!));

  for (const tela of TELAS) {
    test(`${tela.nome}: nenhuma transição ou animação CSS`, async ({ page }) => {
      await abrir(page, tela.url);
      const animados = await page.evaluate(() =>
        [...document.querySelectorAll('*')].flatMap((el) => {
          const cs = getComputedStyle(el);
          const t = cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
          const a = cs.animationName !== 'none';
          return t || a ? [`${el.tagName.toLowerCase()}.${el.className}`] : [];
        })
      );
      expect(animados).toEqual([]);
    });
  }

  for (const url of [PARTIDA, PUBLICADO]) {
    test(`${url}: a arena não toca sozinha nem é baixada; toca ao pedir`, async ({ page }) => {
      const svgs: string[] = [];
      page.on('request', (r) => {
        if (/\/api\/partida\/|raw\.githubusercontent/.test(r.url())) svgs.push(r.url());
      });
      await page.goto(url);
      await expect(page.locator('.arena-auto')).toBeHidden();
      await expect(page.getByText('Seu sistema pede menos movimento')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Pausar a animação' })).toBeHidden();
      await page.waitForTimeout(500);
      expect(svgs, 'nenhuma animação baixada antes do pedido').toEqual([]);
      const sob = page.locator('details.arena-sob-demanda');
      await sob.locator('summary').click();
      await expect(sob.locator('img')).toBeVisible();
      expect(await anima(page, 'details.arena-sob-demanda img')).toBe(true);
    });
  }
});

test.describe('sem preferência de movimento', () => {
  test.beforeEach(async ({ page, baseURL }) => rotasLocais(page, baseURL!));

  test('a arena toca sozinha e oferece "Pausar a animação"', async ({ page }) => {
    await page.goto(PARTIDA);
    await expect(page.locator('.arena-auto img')).toBeVisible();
    await expect(page.locator('details.arena-sob-demanda')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Pausar a animação' })).toBeVisible();
    expect(await anima(page, '.arena-auto img')).toBe(true);
  });

  test('pausada (?animacao=parada): nada se move até a pessoa abrir', async ({ page }) => {
    await page.goto(`${PARTIDA}?animacao=parada`);
    await expect(page.locator('.arena-auto')).toHaveCount(0);
    await expect(page.locator('details.arena-sob-demanda img')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Voltar à reprodução automática' })).toBeVisible();
  });

  test('a regra de movimento reduzido do próprio SVG não para o SMIL (por isso o site trata)', async ({ browser }) => {
    // Registro do comportamento do navegador: se um dia isso mudar, o teste avisa.
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1200, height: 300 } });
    const page = await ctx.newPage();
    await page.goto(`/api/partida/ana-arcade/${ONTEM}?tema=github-dark`);
    expect(await anima(page, 'svg')).toBe(true);
    await ctx.close();
  });
});
