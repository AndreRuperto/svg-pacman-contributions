/** axe (WCAG 2.2 A/AA + boas práticas) e overflow horizontal em todas as telas e larguras, e com zoom de 200%. */
import { expect, test } from '@playwright/test';
import { ALTURA, LARGURAS, LARGURAS_ZOOM, TELAS, abrir, axe, overflow, rotasLocais } from './apoio';

for (const tela of TELAS) {
  test.describe(tela.nome, () => {
    for (const largura of LARGURAS) {
      test(`${largura}px: axe sem violações e sem overflow`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: largura, height: ALTURA });
        await rotasLocais(page, baseURL!);
        await abrir(page, tela.url);
        expect(await axe(page)).toEqual([]);
        const o = await overflow(page);
        expect(o.fora, `elementos além de ${o.largura}px`).toEqual([]);
        expect(o.rolagem).toBeLessThanOrEqual(o.largura);
      });
    }

    for (const largura of LARGURAS_ZOOM) {
      test(`${largura}px com zoom 200%: axe e sem overflow`, async ({ browser, baseURL }) => {
        // Zoom de 200% = metade dos pixels CSS com o dobro de densidade.
        const contexto = await browser.newContext({
          viewport: { width: largura / 2, height: ALTURA / 2 },
          deviceScaleFactor: 2,
          locale: 'pt-BR'
        });
        const page = await contexto.newPage();
        await rotasLocais(page, baseURL!);
        await abrir(page, tela.url);
        expect(await axe(page)).toEqual([]);
        const o = await overflow(page);
        expect(o.fora, `elementos além de ${o.largura}px`).toEqual([]);
        expect(o.rolagem).toBeLessThanOrEqual(o.largura);
        await contexto.close();
      });
    }
  });
}
