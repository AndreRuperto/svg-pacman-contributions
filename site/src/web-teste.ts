/**
 * Servidor do site em modo de teste: memória, dados fixos (`fixture.ts`), sem banco e sem rede.
 * Usado pelos testes de acessibilidade (Playwright + axe) e pelas capturas de tela.
 *   PORT=3457 pnpm site:teste
 */
import { serve } from '@hono/node-server';
import { criarAppFixture } from './fixture.js';

const porta = Number(process.env.PORT ?? 3457);
const inicio = Date.now();

criarAppFixture()
  .then((app) => {
    const servidor = serve({ fetch: app.fetch, port: porta }, (info) =>
      console.log(`[teste] dados fixos prontos em ${Date.now() - inicio} ms; ouvindo em http://localhost:${info.port}`)
    );
    const encerrar = () => servidor.close(() => process.exit(0));
    process.once('SIGTERM', encerrar);
    process.once('SIGINT', encerrar);
  })
  .catch((e) => {
    console.error('[teste] não consegui montar os dados fixos:', e);
    process.exit(1);
  });
