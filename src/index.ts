import { Game } from './core/game.js';
import { Grid } from './utils/grid.js';
import { Store } from './core/store.js';
import { Config, StoreType } from './types.js';
import { Utils } from './utils/utils.js';
import { fetchGithubContributionsGraphQL } from './providers/github-contributions.js';
import { createRng, defaultSeed } from './utils/rng.js';

export class PacmanRenderer {
  store!: StoreType;
  conf: Config;

  constructor(conf: Config) {
    this.conf = { ...conf };
    // Store será inicializado no start()
  }

  public async start() {
    const defaultConfig: Config = {
      platform: 'github',
      username: '',
      canvas: undefined as unknown as HTMLCanvasElement,
      outputFormat: 'svg',
      svgCallback: (_: string) => {},
      gameOverCallback: () => {},
      gameTheme: 'github',
      gameSpeed: 1,
      enableSounds: false,
      githubSettings: { accessToken: '' },
    };

    // Reinicializa o store a cada chamada de start()
    this.store = JSON.parse(JSON.stringify(Store));
    this.store.config = { ...defaultConfig, ...this.conf };
    this.store.rng = createRng(
      this.store.config.seed ??
        defaultSeed(
          this.store.config.username,
          this.store.config.date ? new Date(`${this.store.config.date}T00:00:00Z`) : undefined
        )
    );

    switch (this.store.config.platform) {
      case 'github':
        if (this.store.config.githubSettings?.accessToken) {
          try {
            const username = this.store.config.username;
            const token = this.store.config.githubSettings.accessToken;
            this.store.contributions = await fetchGithubContributionsGraphQL(this.store, username, token);
            console.log(`Obtidas ${this.store.contributions.length} contribuições via GraphQL`);
          } catch (error) {
            console.warn('Erro ao buscar via GraphQL, usando método alternativo:', error);
            this.store.contributions = await Utils.getGithubContribution(this.store);
          }
        } else {
          this.store.contributions = await Utils.getGithubContribution(this.store);
        }
        break;
      default:
        throw new Error(`Plataforma não suportada: ${this.store.config.platform}`);
    }

    Grid.buildWalls();
    Utils.buildGrid(this.store);
    Utils.buildMonthLabels(this.store);

    console.log(`Construído grid de ${this.store.grid.length}x${this.store.grid[0].length}`);
    console.log(`Contribuições carregadas: ${this.store.contributions.length}`);

    await Game.startGame(this.store);
    return this.store;
  }

  public stop() {
    Game.stopGame(this.store);
  }
}