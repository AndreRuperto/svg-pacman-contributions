import { html } from 'hono/html';
import { addDays } from '../datas.js';
import type { DadosJogador } from '../dados.js';
import type { PartidaSalva } from '../repo.js';
import {
  dataExtenso,
  decimal,
  duracao,
  inteiro,
  plural,
  urlAvatar,
  urlJogador,
  urlPartida,
  urlPaginaPublicado
} from './formato.js';
import { layout, type Html } from './layout.js';

export const POR_PAGINA = 30;
export const PERIODOS_GRAFICO = ['30d', '90d', 'todos'] as const;
export type PeriodoGrafico = (typeof PERIODOS_GRAFICO)[number];
const NOME_PERIODO: Record<PeriodoGrafico, string> = {
  '30d': '30 dias',
  '90d': '90 dias',
  todos: 'Tudo'
};
/** Acima disso, o gráfico desenha só a linha: os pontos virariam uma mancha. */
const MAX_PONTOS_VISIVEIS = 60;

// Medidas do gráfico (unidades do viewBox).
const L = 52;
const R = 12;
const T = 12;
const B = 30;
const W = 640;
const H = 220;

/** Teto "redondo" e múltiplo de 4, para as 5 linhas de grade caírem em inteiros: 9123 → 10000, 1240 → 1500. */
function tetoRedondo(max: number): number {
  if (max <= 0) return 100;
  const passo = Math.max(1, 10 ** Math.floor(Math.log10(max)) / 2);
  return Math.ceil(Math.ceil(max / passo) * passo / 4) * 4;
}

const n1 = (v: number) => Math.round(v * 10) / 10;

/** Agrupa as partidas (em ordem crescente) em trechos de dias seguidos. */
function trechosSeguidos(partidas: PartidaSalva[]): PartidaSalva[][] {
  const trechos: PartidaSalva[][] = [];
  for (const p of partidas) {
    const atual = trechos.at(-1);
    if (atual && addDays(atual[atual.length - 1].data, 1) === p.data) atual.push(p);
    else trechos.push([p]);
  }
  return trechos;
}

function resumoGrafico(pontos: PartidaSalva[]): string {
  const maior = pontos.reduce((a, b) => (b.pontos > a.pontos ? b : a));
  const menor = pontos.reduce((a, b) => (b.pontos < a.pontos ? b : a));
  const ultimo = pontos[pontos.length - 1];
  const v = (p: PartidaSalva) => `${inteiro(p.pontos)} em ${dataExtenso(p.data)}`;
  return `${plural(pontos.length, 'partida', 'partidas')} no período. Maior: ${v(maior)}; menor: ${v(menor)}; último: ${v(ultimo)}.`;
}

function grafico(partidas: PartidaSalva[], inicio: string, fim: string, media: number | null, legendaMedia: string): Html {
  const pontos = partidas.filter((p) => p.data >= inicio && p.data <= fim).sort((a, b) => a.data.localeCompare(b.data));
  if (!pontos.length) return html`<p class="apoio">Ainda não há partidas para o gráfico.</p>`;

  const teto = tetoRedondo(Math.max(...pontos.map((p) => p.pontos), media ?? 0));
  const larg = W - L - R;
  const alt = H - T - B;
  const dia = (d: string) => (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000;
  const span = Math.max(1, dia(fim));
  const x = (d: string) => n1(L + (dia(d) / span) * larg);
  const y = (v: number) => n1(T + alt - (v / teto) * alt);
  const linhas = [0, 1, 2, 3, 4].map((i) => (teto / 4) * i);
  const rotulo = `Pontos por dia, de ${dataExtenso(inicio)} a ${dataExtenso(fim)}`;
  // Dias sem partida quebram a linha; um dia isolado fica só com o ponto.
  const trechos = trechosSeguidos(pontos).filter((t) => t.length > 1);

  return html`<div class="grafico-rolagem" role="region" tabindex="0" aria-label="Explorar gráfico de pontos por dia">
<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${rotulo}" xmlns="http://www.w3.org/2000/svg">
  <g font-family="JetBrains Mono, monospace" font-size="11" fill="#9AA3B2">
    ${linhas.map(
      (v) => html`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#2A303C" stroke-width="1"/>
    <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${inteiro(v)}</text>`
    )}
    <text x="${L}" y="${H - 8}">${dataExtenso(inicio)}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end">${dataExtenso(fim)}</text>
  </g>
  ${media !== null
    ? html`<line x1="${L}" x2="${W - R}" y1="${y(media)}" y2="${y(media)}" stroke="#00E5FF" stroke-width="1.5" stroke-dasharray="6 4"/>`
    : ''}
  ${trechos.map(
    (t) => html`<polyline fill="none" stroke="#FFD23F" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${t
      .map((p) => `${x(p.data)},${y(p.pontos)}`)
      .join(' ')}"/>`
  )}
  ${pontos.length <= MAX_PONTOS_VISIVEIS
    ? pontos.map((p) => html`<circle cx="${x(p.data)}" cy="${y(p.pontos)}" r="3" fill="#FFD23F"/>`)
    : ''}
</svg>
</div>
<p class="sr">${resumoGrafico(pontos)}</p>
<ul class="legenda" aria-hidden="true">
  <li><span class="traco traco-pontos"></span>Pontos</li>
  ${media !== null ? html`<li><span class="traco traco-media"></span>${legendaMedia}</li>` : ''}
</ul>`;
}

/** Média de pontos de todas as partidas do jogador (o gráfico cobre o histórico inteiro). */
function mediaGeral(partidas: PartidaSalva[]): number | null {
  return partidas.length ? partidas.reduce((s, p) => s + p.pontos, 0) / partidas.length : null;
}

function tile(rotulo: string, valor: string, nota: string): Html {
  return html`<div class="tile"><p class="tile-rotulo">${rotulo}</p><p class="tile-valor">${valor}</p><p class="apoio tile-nota">${nota}</p></div>`;
}

const lugar = (pos: number | null) => (pos === null ? 'sem partida no dia' : `${pos}º lugar`);

/** Seta para baixo do resumo; gira quando a partida está aberta. */
const SETA = html`<svg class="seta-abrir" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8 L10 13 L15 8"/></svg>`;

function itemPartida(d: DadosJogador, p: PartidaSalva, podeDesenhar: boolean): Html {
  const detalhes = [
    `Eficiência ${decimal(p.eficiencia)}`,
    plural(p.fantasmas, 'fantasma', 'fantasmas'),
    plural(p.mortes, 'morte', 'mortes'),
    duracao(p.quadros)
  ].join(' · ');
  const quando = dataExtenso(p.data);
  // <details> abre sem JavaScript (a CSP não permite script); a imagem é lazy e só carrega quando a partida é aberta.
  return html`<li><details class="partida">
  <summary class="partida-resumo">
    <span class="partida-info">
      <span class="partida-topo"><time class="partida-data" datetime="${p.data}">${quando}</time><span class="partida-pontos">${inteiro(p.pontos)}<span class="sr"> pontos</span></span></span>
      <span class="partida-meta"><span class="apoio partida-detalhes">${detalhes}</span><span class="partida-situacao${p.interrompida ? ' partida-situacao-interrompida' : ''}">${p.interrompida ? 'Interrompida' : 'Concluída'}</span></span>
    </span>
    ${SETA}
  </summary>
  <div class="partida-corpo">
    ${podeDesenhar
      ? html`<img src="/api/partida/${encodeURIComponent(d.login)}/${p.data}?tema=github-dark" alt="Partida de ${d.login} em ${quando}" width="1166" height="229" loading="lazy" class="partida-svg">`
      : html`<p class="apoio">A animação não está disponível neste servidor.</p>`}
    <p class="partida-links"><a href="${urlPartida(d.login, p.data)}">Abrir em página própria</a>${d.publicado && p.publicado_sha
      ? html`<a href="${urlPaginaPublicado(d.login, p.data)}">Ver como foi publicado</a>`
      : ''}</p>
  </div>
</details></li>`;
}

export function paginaJogador(
  d: DadosJogador,
  hoje: string,
  paginaPedida: number,
  podeDesenhar = true,
  periodoGrafico: PeriodoGrafico = 'todos'
): Html {
  const total = d.partidas.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, paginaPedida), paginas);
  const daPagina = d.partidas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const queryPeriodo = periodoGrafico === 'todos' ? '' : `periodo=${periodoGrafico}`;
  const urlPagina = (n: number) => {
    const parametros = [...(n > 1 ? [`pagina=${n}`] : []), ...(queryPeriodo ? [queryPeriodo] : [])];
    return `${urlJogador(d.login)}${parametros.length ? '?' + parametros.join('&') : ''}`;
  };
  const urlGrafico = (periodo: PeriodoGrafico) => {
    const parametros = [...(pagina > 1 ? [`pagina=${pagina}`] : []), ...(periodo !== 'todos' ? [`periodo=${periodo}`] : [])];
    return `${urlJogador(d.login)}${parametros.length ? '?' + parametros.join('&') : ''}`;
  };
  const doDia = d.partidas.find((p) => p.data === hoje);
  const primeiroDia = d.desde < hoje ? d.desde : hoje;
  const inicioJanela = periodoGrafico === 'todos'
    ? primeiroDia
    : addDays(hoje, periodoGrafico === '30d' ? -29 : -89);
  const inicioGrafico = inicioJanela > primeiroDia ? inicioJanela : primeiroDia;
  const doGrafico = d.partidas.filter((p) => p.data >= inicioGrafico && p.data <= hoje);
  const legendaMedia = periodoGrafico === 'todos' ? 'Média de todas as partidas' : 'Média do período';
  const exibindoInicio = total ? (pagina - 1) * POR_PAGINA + 1 : 0;
  const exibindoFim = Math.min(total, pagina * POR_PAGINA);

  const corpo = html`<div class="perfil-pagina">
<p class="voltar"><a href="/"><span aria-hidden="true">‹</span>Ranking</a></p>
<div class="perfil perfil-identidade">
  <img class="avatar avatar-56" src="${urlAvatar(d.login, 112)}" alt="" width="56" height="56">
  <div class="perfil-dados">
    <h1>${d.login}</h1>
    <p class="apoio">no ranking desde ${dataExtenso(d.desde)} · ${plural(total, 'partida', 'partidas')}</p>
  </div>
</div>
<section class="tiles perfil-metricas" aria-label="Resumo do jogador">
  ${tile('Último dia · pontos', doDia ? inteiro(doDia.pontos) : '—', lugar(d.posicaoHoje.pontos))}
  ${tile('Último dia · eficiência', doDia ? decimal(doDia.eficiencia) : '—', lugar(d.posicaoHoje.eficiencia))}
  ${tile('Recorde', d.recorde ? inteiro(d.recorde.pontos) : '—', d.recorde ? `em ${dataExtenso(d.recorde.data)}` : 'sem partida completa')}
  ${tile('Média 30 dias', d.media30 !== null ? inteiro(d.media30) : '—', 'pontos por partida')}
</section>
<section class="cartao perfil-grafico" aria-labelledby="grafico-titulo">
  <div class="perfil-grafico-topo">
    <div>
      <h2 id="grafico-titulo">Pontos por dia</h2>
      <p class="apoio perfil-grafico-periodo">${plural(doGrafico.length, 'partida', 'partidas')} · ${dataExtenso(inicioGrafico)} a ${dataExtenso(hoje)}</p>
    </div>
    <nav aria-label="Período do gráfico">
      <ul class="perfil-grafico-filtros">
        ${PERIODOS_GRAFICO.map((periodo) => html`<li><a href="${urlGrafico(periodo)}"${periodo === periodoGrafico ? html` aria-current="page"` : ''}>${NOME_PERIODO[periodo]}</a></li>`)}
      </ul>
    </nav>
  </div>
  ${grafico(doGrafico, inicioGrafico, hoje, mediaGeral(doGrafico), legendaMedia)}
  ${doGrafico.length ? html`<p class="apoio grafico-instrucao">Deslize o gráfico horizontalmente para explorar os valores.</p>` : ''}
</section>
<section class="perfil-historico" aria-labelledby="partidas-titulo">
  <div class="perfil-historico-topo">
    <h2 id="partidas-titulo">Partidas</h2>
    <p class="apoio">${total ? `Exibindo ${exibindoInicio}–${exibindoFim} de ${total}` : 'Nenhuma partida registrada'}</p>
  </div>
  ${total
    ? html`<ol class="partidas">${daPagina.map((p) => itemPartida(d, p, podeDesenhar))}</ol>`
    : html`<p class="cartao vazio">Ainda não há partidas deste jogador.</p>`}
  ${paginas > 1
    ? html`<nav class="paginacao" aria-label="Páginas das partidas">
    ${pagina > 1 ? html`<a href="${urlPagina(pagina - 1)}"><span aria-hidden="true">‹</span>Mais recentes</a>` : html`<span></span>`}
    <span class="apoio">Página ${pagina} de ${paginas}</span>
    ${pagina < paginas ? html`<a href="${urlPagina(pagina + 1)}">Mais antigas<span aria-hidden="true">›</span></a>` : html`<span></span>`}
  </nav>`
    : ''}
</section>
</div>`;
  return layout({ titulo: d.login, corpo });
}
