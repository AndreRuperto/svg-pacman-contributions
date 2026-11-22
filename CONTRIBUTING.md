# Contribuindo com SVG Pac-Man Contributions

Obrigado por considerar uma contribuição. Este repositório inclui um **motor de jogo**, uma **GitHub Action** e um **ranking online**; uma alteração em um componente pode afetar os outros.

## Preparar o ambiente

Requisitos: Node.js 20 ou superior e pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm preview --theme brasa --no-open
```

A CI roda os mesmos verificadores e fornece um **PostgreSQL 16 descartável** por meio da variável `TEST_DATABASE_URL`. Para executar o contrato localmente, use um banco **dedicado a testes e descartável**, nunca o banco de produção: os testes executam `TRUNCATE`.

```bash
TEST_DATABASE_URL=postgres://pacman:senha@127.0.0.1:5432/pacman_test pnpm test
```

## Regras para mudanças no motor e ranking

- O cron grava o **placar** e a **janela compacta das contribuições públicas**. Não descarte ou modifique a janela usada na partida; sem ela, não há replay verificável.
- A rota de replay deve reexecutar a partida com o snapshot e **rejeitar** divergências em placar, versão do motor ou métricas. Não substitua silenciosamente dados históricos por valores atuais do GitHub.
- Registros antigos sem snapshot continuam com o aviso de **reconstrução aproximada**; não marcar esses registros como replays exatos.
- Se alterar regras, movimentos, IA, geração de pontuação ou formato de jogo, revisar e incrementar a versão do motor (`package.json`) e explicar como tratar partidas da versão anterior. Atualizar testes de determinismo.
- Qualquer alteração no schema deve ser **aditiva e idempotente** e não pode apagar placares históricos.
- No PostgreSQL, guardar janelas em JSONB, mas **não incluí-las na resposta de listagem do ranking**, para evitar payloads volumosos.

## GitHub Action e SVG

- Validar nome de usuário, tema, estilo e velocidade antes de iniciar o render.
- Tokens são segredos. Não colocá-los em logs, issues, commits ou exemplos com valores reais.
- Se uma alteração em `src/` afeta a Action, regenerar e incluir o bundle distribuído:

```bash
pnpm run build:action
git add github-action/dist/index.js
```

- A CI recompila a Action e exige que o bundle distribuído esteja idêntico. **Não remova esse verificador** para fazer testes passarem.
- Novas animações precisam respeitar temas claro/escuro, alto contraste, tela pequena, títulos/descritivos acessíveis e preferência por movimento reduzido. Compare o SVG no README e em navegadores modernos; animações SMIL nem sempre têm o mesmo comportamento em todos os leitores.

## Abrindo uma issue ou PR

Informe: comportamento esperado e observado, passos para reproduzir, tema e `player_style`, versão do Node e navegador (se afetar SVG), data e login **público** (se necessário) e link para uma execução de CI. Para erros de replay, informe a data da partida, a versão do motor e se o site mostra o aviso de reconstrução histórica.

Evite capturas com dados pessoais e remova qualquer token de logs antes de enviar.

**Checklist do PR:**

- [ ] Mudança descrita com problema, solução e limitações.
- [ ] `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm test` passaram.
- [ ] Alterações de API, banco ou motor têm testes de regressão.
- [ ] Bundle de Action atualizado quando necessário.
- [ ] SVG conferido em pelo menos um tema claro e um escuro, com zoom e movimento reduzido.
- [ ] README e `PROXIMOS_PASSOS.md` atualizados se a mudança alterar o comportamento público.
