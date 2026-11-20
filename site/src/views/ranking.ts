import { html } from 'hono/html';
import { addDays } from '../datas.js';
import type { DadosRanking, LinhaRanking } from '../dados.js';
import type { Aba, Periodo } from '../ranking.js';
import {
  EDITAR_LISTA_URL,
  dataExtenso,
  decimal,
  duracao,
  inteiro,
  plural,
  urlAvatar,
  urlJogador
} from './formato.js';
import { layout, type Html } from './layout.js';

const NOME_ABA: Record<Aba, string> = { pontos: 'Pontos', eficiencia: 'Eficiência' };
const NOME_PERIODO: Record<Periodo, string> = { hoje: 'Último dia', '7d': '7 dias', recorde: 'Recorde' };

const url = (aba: Aba, periodo: Periodo) => `/?aba=${aba}&periodo=${periodo}`;
const atual = (sim: boolean) => (sim ? html` aria-current="page"` : '');

function legendaPeriodo(periodo: Periodo, hoje: string): string {
  if (periodo === 'hoje') return `Último dia · ${dataExtenso(hoje)}`;
  if (periodo === '7d') return `7 dias · média de ${dataExtenso(addDays(hoje, -6))} a ${dataExtenso(hoje)}`;
  return 'Recorde · a melhor partida de cada jogador';
}

const valorDa = (aba: Aba, l: LinhaRanking) => (aba === 'pontos' ? inteiro(l.valor) : decimal(l.valor));
const resumo = (l: LinhaRanking) =>
  `${plural(l.fantasmas, 'fantasma', 'fantasmas')} · ${plural(l.mortes, 'morte', 'mortes')} · ${duracao(l.quadros)}`;
const classePosicao = (l: LinhaRanking) => (l.posicao === 1 ? 'pos pos-1' : 'pos');

function tabela(d: DadosRanking): Html {
  return html`<table class="tabela">
  <caption class="sr">Ranking por ${NOME_ABA[d.aba].toLowerCase()}, ${legendaPeriodo(d.periodo, d.hoje)}</caption>
  <thead><tr>
    <th scope="col">#</th><th scope="col">Jogador</th>
    <th scope="col" class="num">Pontos</th><th scope="col" class="num">Eficiência</th>
    <th scope="col" class="num">Fantasmas</th><th scope="col" class="num">Mortes</th>
    <th scope="col" class="num">Duração</th>
  </tr></thead>
  <tbody>
  ${d.linhas.map(
    (l) => html`<tr>
    <td class="${classePosicao(l)}">${l.posicao}</td>
    <td><a class="jogador" href="${urlJogador(l.login)}"><img class="avatar" src="${urlAvatar(l.login, 56)}" alt="" width="28" height="28" loading="lazy">${l.login}</a></td>
    <td class="num${d.aba === 'pontos' ? ' ativo' : ''}">${inteiro(l.pontos)}</td>
    <td class="num${d.aba === 'eficiencia' ? ' ativo' : ''}">${decimal(l.eficiencia)}</td>
    <td class="num">${l.fantasmas}</td>
    <td class="num">${l.mortes}</td>
    <td class="num">${duracao(l.quadros)}</td>
  </tr>`
  )}
  </tbody>
</table>`;
}

function cartoes(d: DadosRanking): Html {
  return html`<ol class="cartoes" aria-label="Ranking por ${NOME_ABA[d.aba].toLowerCase()}">
  ${d.linhas.map(
    (l) => html`<li><a class="linha" href="${urlJogador(l.login)}">
    <span class="${classePosicao(l)}">${l.posicao}</span>
    <img class="avatar avatar-36" src="${urlAvatar(l.login, 72)}" alt="" width="36" height="36" loading="lazy">
    <span class="linha-texto"><span class="linha-login">${l.login}</span><span class="apoio">${resumo(l)}</span></span>
    <span class="linha-valor">${valorDa(d.aba, l)}<span class="sr"> ${NOME_ABA[d.aba].toLowerCase()}</span></span>
  </a></li>`
  )}
</ol>`;
}

export function paginaRanking(d: DadosRanking): Html {
  const corpo = html`<h1>Ranking</h1>
<p class="sub">Cada jogador tem uma partida por dia, jogada sobre o próprio gráfico de contribuições.</p>
<div class="filtros">
  <nav aria-label="Métrica">
    <ul class="segmentos">
      ${(['pontos', 'eficiencia'] as const).map(
        (a) => html`<li><a href="${url(a, d.periodo)}"${atual(a === d.aba)}>${NOME_ABA[a]}</a></li>`
      )}
    </ul>
  </nav>
  <nav aria-label="Período">
    <ul class="pilulas">
      ${(['hoje', '7d', 'recorde'] as const).map(
        (p) => html`<li><a href="${url(d.aba, p)}"${atual(p === d.periodo)}>${NOME_PERIODO[p]}</a></li>`
      )}
    </ul>
  </nav>
</div>
<p class="periodo">${legendaPeriodo(d.periodo, d.hoje)}</p>
${d.linhas.length
  ? html`${tabela(d)}${cartoes(d)}`
  : html`<p class="cartao vazio">Ainda não há partidas para este período.</p>`}
<section class="cartao convite" aria-labelledby="convite-titulo">
  <h2 id="convite-titulo">Quer entrar no ranking?</h2>
  <p>Adicione seu login do GitHub em <code>ranking/jogadores.json</code> com um pull request. Na rodada seguinte do cron, suas partidas entram no ranking.</p>
  <a class="botao" href="${EDITAR_LISTA_URL}">Editar a lista de jogadores</a>
</section>`;
  return layout({ titulo: 'Ranking', atual: 'ranking', corpo });
}
