import { defineConfig, devices } from '@playwright/test';

/** Porta do servidor de teste (a 3000 costuma estar ocupada na máquina de desenvolvimento). */
const PORTA = Number(process.env.PORTA_TESTE ?? 3457);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORTA}`,
    ...devices['Desktop Chrome'],
    locale: 'pt-BR',
    trace: 'retain-on-failure'
  },
  webServer: {
    // Site em memória com dados fixos (site/src/fixture.ts): sem banco e sem GitHub.
    command: 'pnpm site:teste',
    env: { PORT: String(PORTA) },
    url: `http://localhost:${PORTA}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe'
  }
});
