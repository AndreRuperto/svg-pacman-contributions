/** Teclado: toda parada do Tab tem foco visível e na tela; filtros, partidas, setas, tema e pausa funcionam sem mouse. */
import { expect, test, type Page } from '@playwright/test';
import { ONTEM, TELAS, abrir, focoNoInicio, percorrerFoco, rotasLocais } from './apoio';

test.beforeEach(async ({ page, baseURL }) => rotasLocais(page, baseURL!));

for (const largura of [320, 390, 1440]) {
  for (const tela of TELAS) {
    test(`${tela.nome} ${largura}px: foco visível em todas as paradas do Tab`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrir(page, tela.url);
      const paradas = await percorrerFoco(page);
      expect(paradas.length).toBeGreaterThan(3);
      expect(paradas[0].alvo).toContain('Pular para o conteúdo');
      expect(paradas.filter((p) => !p.visivel), 'paradas sem contorno de foco').toEqual([]);
      expect(paradas.filter((p) => !p.naTela), 'paradas fora da tela').toEqual([]);
    });
  }
}

/** Aperta Tab até o elemento com este nome acessível receber o foco. */
async function tabAte(page: Page, nome: RegExp, maximo = 60) {
  await focoNoInicio(page);
  for (let i = 0; i < maximo; i++) {
    await page.keyboard.press('Tab');
    const atual = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
    });
    if (nome.test(atual)) return;
  }
  throw new Error(`não cheguei a ${nome} só com Tab`);
}

test('pular para o conteúdo leva ao <main>', async ({ page }) => {
  await abrir(page, '/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.pular')).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#conteudo$/);
});

test('ranking: métrica e período trocam com Enter', async ({ page }) => {
  await abrir(page, '/');
  await tabAte(page, /^Eficiência$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/aba=eficiencia/);
  await tabAte(page, /^7 dias$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/aba=eficiencia&periodo=7d/);
  await expect(page.getByRole('link', { name: '7 dias' })).toHaveAttribute('aria-current', 'page');
});

test('perfil: partida da lista abre com Enter e fecha com Espaço; período do gráfico com Enter', async ({ page }) => {
  await page.goto('/jogador/ana-arcade');
  await tabAte(page, /^30 dias$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/periodo=30d/);
  const primeira = page.locator('details.partida').first();
  await tabAte(page, /^20 nov\. 2026/);
  await page.keyboard.press('Enter');
  await expect(primeira).toHaveAttribute('open', '');
  await expect(primeira.locator('img')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(primeira).not.toHaveAttribute('open', '');
});

test('partida: setas de dia anterior e seguinte com Enter', async ({ page }) => {
  await page.goto(`/jogador/ana-arcade/${ONTEM}`);
  await tabAte(page, /^Dia anterior, 18 nov\. 2026/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/jogador\/ana-arcade\/2026-11-18$/);
  await tabAte(page, /^Dia seguinte, 19 nov\. 2026/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/jogador/ana-arcade/${ONTEM}$`));
});

test('partida: tema escolhido e enviado só com teclado, mantendo a pausa', async ({ page }) => {
  await page.goto(`/jogador/ana-arcade/${ONTEM}?animacao=parada`);
  await tabAte(page, /GitHub claro.*GitHub escuro/);
  await expect(page.locator('#tema')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mudar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tema=brasa&animacao=parada/);
  await expect(page.locator('#tema')).toHaveValue('brasa');
});

test('partida: pausar e reproduzir a animação pelo teclado', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`/jogador/ana-arcade/${ONTEM}`);
  await tabAte(page, /^Pausar a animação$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/animacao=parada/);
  const sob = page.locator('details.arena-sob-demanda');
  await expect(sob.locator('img')).toBeHidden();
  await tabAte(page, /^Reproduzir a animação$/);
  await page.keyboard.press('Enter');
  await expect(sob.locator('img')).toBeVisible();
  await tabAte(page, /^Voltar à reprodução automática$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/jogador/ana-arcade/${ONTEM}$`));
});
