# 👻 SVG-Pacman-Contributions

Transforme seu gráfico de contribuições do GitHub em um jogo animado de Pac-Man! Veja como o Pac-Man devora suas contribuições enquanto desvia dos fantasmas em uma experiência nostálgica de arcade.

<picture>
  <img alt="Pac-Man contribution graph"
       src="https://raw.githubusercontent.com/AndreRuperto/AndreRuperto/output/dist/pacman-contribution-graph-dark.svg">
</picture>

Esta versão se concentra especificamente na geração de animações SVG otimizadas, com melhorias significativas na jogabilidade e na aparência visual.

## 🎮 Funcionalidades

- **Integração com GitHub**: Busca automaticamente seus dados de contribuição via API GraphQL
- **Jogabilidade do Pac-Man**: Mecânicas clássicas do Pac-Man onde commits são pontos comestíveis
- **Animação SVG Aprimorada**: Exporta um SVG animado com melhorias visuais e comportamentais
- **GitHub Action**: Fácil de adicionar ao README do seu perfil ou site
- **Múltiplos Temas**: Suporta temas GitHub claro/escuro e GitLab claro/escuro

## 🚀 Como Usar

### GitHub Action

- O arquivo YAML deve ser criado no caminho .github/workflows/pacman.yml
- Você deve criar uma branch chamada output para o GitHub armazenar os SVGs gerados

```yaml
name: Atualizar Pac-Man Contribution

on:
  schedule:
    - cron: "0 0 * * *"         # Executa diariamente à meia-noite
  workflow_dispatch:            # Permite execução manual

jobs:
  build:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v3

      - name: Criar diretório dist
        run: mkdir -p dist

      - name: Gerar gráfico de contribuições estilo Pac-Man
        uses: AndreRuperto/svg-pacman-contributions@main
        with:
          github_user_name: ${{ github.repository_owner }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          theme: github-dark
          output_directory: dist
          player_style: oportunista

      - name: Publicar SVG na branch output
        uses: crazy-max/ghaction-github-pages@v3.1.0
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## ⏳ Executar o Workflow Manualmente
Depois de configurar tudo:

- Vá para a aba "Actions" no seu repositório
- Clique em "Atualizar Pac-Man Contribution"
- Clique em "Run workflow" > "Run workflow"

Isso iniciará o processo de geração do SVG e depois você poderá ver a animação funcionando no seu README!
Essa implementação permitirá que seu gráfico de contribuições do Pac-Man seja atualizado automaticamente todos os dias, mantendo-o sempre atual com suas contribuições mais recentes.


## 📄 Adicionando o SVG ao README

```markdown
<picture>
  <img alt="Pac-Man contribution graph" src="https://raw.githubusercontent.com/seuusuario/seuusuario/output/nome-do-arquivo-gerado-no-output.svg">
</picture>
```

## 🎯 Como Funciona

A aplicação usa seus dados de contribuição do GitHub para:

1. Criar uma grade onde cada célula representa um dia de contribuição
2. Utilizar os níveis de intensidade de contribuição fornecidos pela API do GitHub:

- NONE: Dias sem contribuições (espaços vazios no jogo)
- FIRST_QUARTILE: Dias com poucas contribuições (pontos pequenos, 1 ponto no jogo)
- SECOND_QUARTILE: Dias com contribuições moderadas (pontos médios, 2 pontos)
- THIRD_QUARTILE: Dias com muitas contribuições (pontos grandes, 5 pontos)
- FOURTH_QUARTILE: Dias com contribuições excepcionais (power pellets que ativam o modo de comer fantasmas)

Esses níveis são relativos ao padrão de contribuições de cada usuário e calculados automaticamente pelo GitHub, portanto a densidade de elementos no jogo refletirá o perfil único de cada um.

3. Pac-Man navega pela grade com A*, escolhendo o alvo pelo valor dos pontos e pelo perigo previsto de cada fantasma (o peso de cada fator muda conforme o estilo de jogo)
4. Fantasmas perseguem o Pac-Man com comportamentos únicos (como no jogo original); assustados, viram de costas e fogem com um pouco de aleatoriedade
5. **Túneis**: a linha do meio tem saídas nas duas bordas. Pac-Man e fantasmas entram por um lado e saem pelo outro (como no arcade), e as bocas do túnel acendem em ciano quando alguém passa. Dentro do túnel os fantasmas andam mais devagar
6. Toda a jogabilidade é gravada e exportada como um SVG animado

## 📋 Opções de Configuração

### Entradas da GitHub Action

| Entrada            | Descrição                                | Padrão         | Valores Possíveis                             |
|--------------------|------------------------------------------|----------------|-----------------------------------------------|
| `github_user_name` | Usuário do GitHub                        | (obrigatório)  | Qualquer nome de usuário válido do GitHub     |
| `github_token`     | Token do GitHub para acesso à API        | (obrigatório)  | `secrets.GITHUB_TOKEN` ou token pessoal com leitura pública |
| `theme`            | Tema de cores                            | `github-dark`  | `github`, `github-dark`, `brasa`, `arcade`, `neon`, `alto-contraste`, `gitlab`, `gitlab-dark` |
| `output_directory` | Pasta de saída dos SVGs                  | `dist`         | Qualquer caminho local válido                 |
| `player_style`     | Estilo de jogo do Pac-Man                | `oportunista`  | `oportunista`, `agressivo`, `conservador`     |
| `speed`            | Velocidade da animação                   | `normal`       | `slow` (½×), `normal`, `fast` (2×) ou um multiplicador (ex.: `1.5`) |

### Opções da biblioteca (`PacmanRenderer`)

| Opção             | Descrição                                 | Padrão         | Valores Possíveis                             |
|-------------------|-------------------------------------------|----------------|-----------------------------------------------|
| `username`        | Nome de usuário do GitHub                 | (obrigatório)  | Qualquer nome de usuário válido do GitHub     |
| `gameTheme`       | Tema de cores                             | `github`       | `github`, `github-dark`, `brasa`, `arcade`, `neon`, `alto-contraste`, `gitlab`, `gitlab-dark` |
| `githubSettings.accessToken` | Token do GitHub para acesso à API | —        | Token pessoal válido (com permissão de leitura pública) |
| `playerStyle`     | Estilo do Pac-Man                         | `oportunista`  | `oportunista`, `agressivo`, `conservador`     |
| `seed`            | Semente da partida                        | usuário + data (UTC) | Qualquer string — a mesma semente gera a mesma partida |
| `animationSpeed`  | Velocidade da animação                    | `normal`       | `'slow'`, `'normal'`, `'fast'` ou um número > 0 |
| `debug`           | Liga logs de diagnóstico da IA            | `false`        | `true`, `false`                               |

### 🎨 Temas

| Tema | Visual |
|------|--------|
| `github` / `github-dark` | Verdes do GitHub (claro e escuro) |
| `brasa` | Carvão e laranja |
| `arcade` | Fundo preto, paredes azuis, power-up cor de pêssego |
| `neon` | Roxo noturno com paredes magenta |
| `alto-contraste` | Preto, rampa de azul por claridade e paredes laranja |
| `gitlab` / `gitlab-dark` | Roxo-azulado do calendário do GitLab |

Todo tema define as mesmas cores (fundo, células, paredes, textos, túnel, Pac-Man, power-up e fantasma piscando) e passa nos testes de contraste: texto ≥ 4,5:1 e paredes ≥ 3:1 sobre o fundo. Nos temas claros, o Pac-Man ganha contorno escuro para não sumir no branco.

No fim da animação, um placar mostra pontos, fantasmas comidos, maior combo, mortes e duração.

### 🎲 Partida estável durante o dia

Todo sorteio do jogo (fuga dos fantasmas assustados, desempates) usa uma semente formada pelo **usuário + a data em UTC** (ex.: `andreruperto:2026-11-19`). Assim, rodar a Action várias vezes no mesmo dia gera exatamente a mesma animação; no dia seguinte, a partida muda. Para fixar uma partida, passe `seed` na configuração da biblioteca.

## 🧩 Melhorias Implementadas

Esta versão inclui várias melhorias em relação à implementação original:

- **Fantasmas Aprimorados**: Novas imagens e animações mais fiéis ao jogo original
- **Olhos Direcionais**: Os olhos dos fantasmas se movem de acordo com a direção em que estão indo
- **Power-up Aperfeiçoado**: Melhor lógica e feedback visual durante o modo de power-up
- **Casa dos Fantasmas**: Design melhorado para a área inicial dos fantasmas
- **Otimização SVG**: Geração de SVG mais eficiente e com animações mais suaves
- **Estilos de Jogabilidade do Pac-Man**: Três diferentes comportamentos configuráveis:
  - **Oportunista** (padrão): Equilibra a busca por pontos e a segurança. O Pac-Man avalia tanto o perigo dos fantasmas quanto as recompensas das contribuições, tomando decisões balanceadas.
  - **Agressivo**: Prioriza a coleta de pontos mesmo com fantasmas próximos. Ignora parcialmente o perigo e foca em maximizar a pontuação, criando uma animação mais dinâmica e arriscada.
  - **Conservador**: Extremamente cauteloso, prioriza a sobrevivência acima de tudo. Evita ativamente áreas com fantasmas mesmo que contenha muitos pontos, resultando em um jogo mais longo e seguro.

## 👻 Fantasmas atualizados
Cada fantasma ganhou novas imagens e personalidades fiéis aos do jogo original.

| Fantasma | Pré-visualização | Comportamento |
|:--------:|:----------------:|:-------------|
| **Blinky** (vermelho) | <p align="center"><img src="src/assets/gifs/red_flip.gif" height="40" alt="Blinky"></p> | Perseguidor agressivo que mira diretamente no Pac-Man. Fica mais rápido quando restam poucos pontos no mapa, o que os jogadores chamam de "modo Elroy". |
| **Pinky** (rosa) | <p align="center"><img src="src/assets/gifs/pink_flip.gif" height="40" alt="Pinky"></p> | Estrategista que tenta emboscar o Pac-Man se posicionando 4 casas à frente da direção atual dele. É especialista em armadilhas e emboscadas. |
| **Inky** (ciano) | <p align="center"><img src="src/assets/gifs/cyan_flip.gif" height="40" alt="Inky"></p> | Imprevisível e complexo. Usa a posição do Blinky como referência para seu movimento, calculando um vetor que passa pelo Pac-Man e depois dobrando essa distância. |
| **Clyde** (laranja) | <p align="center"><img src="src/assets/gifs/orange_flip.gif" height="40" alt="Clyde"></p> | Tímido e errático. Persegue o Pac-Man quando está longe, mas quando se aproxima a menos de 8 casas de distância, foge para seu canto. Esse comportamento "tímido" o torna menos previsível. |

## 🔧 Desenvolvimento

Construído com TypeScript e Node.js, o projeto consiste em:

- `src/`: Lógica principal do jogo e renderização
- `tools/preview.ts`: Preview local do SVG
- `github-action/`: Integração com GitHub Action
- `tests/`: Testes com Vitest (regras de comer, túneis, fantasmas, IA e uma partida completa por estilo)

Comandos úteis:

```bash
pnpm install
pnpm test                 # roda todos os testes
pnpm exec tsc --noEmit    # checagem de tipos
pnpm run build:web        # gera dist/pacman-contribution-graph.min.js
pnpm run build:action     # gera github-action/dist/index.js
```

### 👀 Preview local

```bash
pnpm preview                                         # mapa sorteado, oportunista, github-dark
pnpm preview --style agressivo --theme brasa --speed fast --seed abc
GITHUB_TOKEN=seu_token pnpm preview --user seu_login # suas contribuições reais
```

O SVG é gravado em `outputs/preview-<estilo>-<tema>.svg` e aberto no navegador (`--no-open` para só gravar).

A partida completa (`tests/full-game.test.ts`) grava um SVG por estilo em `outputs/partida-<estilo>.svg` — abra no navegador para conferir a animação.

## 🙏 Créditos

Este projeto é uma versão especializada baseada no [Pac-Man Contribution Graph](https://github.com/abozanona/pacman-contribution-graph) criado por [abozanona](https://github.com/abozanona). Enquanto o projeto original oferece tanto visualizações SVG quanto Canvas, esta versão foca exclusivamente em melhorias à renderização SVG e na experiência de jogabilidade automatizada.

## 🤝 Como contribuir
Ficou com vontade de adicionar um novo tema, melhorar a IA dos fantasmas ou otimizar o SVG?  
Pull requests são **muito** bem-vindos!  

1. **Fork** o repositório  
2. Crie sua branch: `git checkout -b feat/minha-melhoria`  
3. Faça commits claros e concisos  
4. Abra um PR explicando o que mudou e _por quê_  

Se tiver dúvidas, abra uma _issue_. 👊

---

<p align="center">
  Esses fantasmas trabalham muito! Deixe um cafuné antes de sair.<br>
  <img src="src/assets/gifs/pink_pet_cafune.gif" alt="Fantasma sendo acariciado" height="80">
</p>