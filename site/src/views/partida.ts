import { html } from 'hono/html';
import type { ThemeKeys } from '../../../src/types.js';
import type { DadosJogador } from '../dados.js';
import type { PartidaSalva } from '../repo.js';
import {
  NOMES_TEMAS,
  dataExtenso,
  decimal,
  duracao,
  inteiro,
  urlJogador,
  urlPaginaPublicado,
  urlPartida
} from './formato.js';
import { layout, type Html } from './layout.js';

export interface PartidaPagina {
  jogador: DadosJogador;
  partida: PartidaSalva;
  tema: ThemeKeys;
  temaPadrao: ThemeKeys;
  /** `false`: o servidor não desenha partidas, a tela mostra um aviso no lugar da animação. */
  podeDesenhar?: boolean;
  /** True apenas se o cron preservou a janela de contribuições desta partida. */
  snapshotDisponivel?: boolean;
}

function seta(data: string | undefined, rotulo: string, simbolo: string, login: string, sufixo: string): Html {
  return data
    ? html`<a class="seta" href="${urlPartida(login, data)}${sufixo}" aria-label="${rotulo}, ${dataExtenso(data)}">${simbolo}</a>`
    : html`<span class="seta seta-off" aria-hidden="true">${simbolo}</span>`;
}

function stat(rotulo: string, valor: string): Html {
  return html`<div class="tile"><p class="tile-rotulo">${rotulo}</p><p class="tile-valor">${valor}</p></div>`;
}

export function paginaPartida({ jogador, partida: p, tema, temaPadrao, podeDesenhar = true, snapshotDisponivel = false }: PartidaPagina): Html {
  const { login } = jogador;
  // jogador.partidas está em ordem de data decrescente
  const i = jogador.partidas.findIndex((x) => x.data === p.data);
  const seguinte = jogador.partidas[i - 1]?.data;
  const anterior = jogador.partidas[i + 1]?.data;
  const sufixo = tema === temaPadrao ? '' : `?tema=${tema}`;
  const quando = dataExtenso(p.data);

  const corpo = html`<p class="voltar"><a href="${urlJogador(login)}">‹ ${login}</a></p>
<div class="dia-nav">
  ${seta(anterior, 'Dia anterior', '‹', login, sufixo)}
  <h1><span class="sr">${login}, </span>${quando}</h1>
  ${seta(seguinte, 'Dia seguinte', '›', login, sufixo)}
</div>
${snapshotDisponivel
  ? html`<p class="cartao apoio">Replay com a janela de contribuições preservada. O servidor confere o placar antes de disponibilizar a animação.</p>`
  : html`<p class="cartao aviso">Partida histórica sem calendário original guardado: a animação abaixo é uma reconstrução com as contribuições atuais e pode diferir do placar. Se houver banner publicado, use “Ver como foi publicado neste dia”.</p>`}
${podeDesenhar
  ? html`<div class="cartao palco">
  <img src="/api/partida/${encodeURIComponent(login)}/${p.data}?tema=${tema}" alt="Partida de ${login} em ${quando}" width="1166" height="229" class="partida-svg">
</div>
<form class="tema-form" method="get" action="${urlPartida(login, p.data)}">
  <label for="tema">Tema da animação</label>
  <div class="tema-campos">
    <select id="tema" name="tema">
      ${(Object.keys(NOMES_TEMAS) as ThemeKeys[]).map(
        (t) => html`<option value="${t}"${t === tema ? html` selected` : ''}>${NOMES_TEMAS[t]}</option>`
      )}
    </select>
    <button class="botao" type="submit">Mudar</button>
  </div>
</form>`
  : html`<p class="cartao vazio">A animação não está disponível neste servidor.</p>`}
${p.interrompida
  ? html`<p class="cartao aviso">Partida interrompida no limite de quadros: conta no dia e nos 7 dias, mas fica fora do recorde.</p>`
  : ''}
<div class="tiles tiles-6">
  ${stat('Pontos', inteiro(p.pontos))}
  ${stat('Eficiência', decimal(p.eficiencia))}
  ${stat('Fantasmas', String(p.fantasmas))}
  ${stat('Maior combo', `×${p.maior_combo}`)}
  ${stat('Mortes', String(p.mortes))}
  ${stat('Duração', duracao(p.quadros))}
</div>
${jogador.publicado && p.publicado_sha
  ? html`<p><a class="botao botao-sec" href="${urlPaginaPublicado(login, p.data)}">Ver como foi publicado neste dia</a></p>`
  : ''}`;
  return layout({ titulo: `${login} em ${quando}`, corpo });
}

/**
 * O SVG como apareceu no README do perfil naquele dia. Ele é mostrado como <img>: aberto direto no
 * raw.githubusercontent.com, a CSP do GitHub (default-src 'none') bloqueia as imagens embutidas nele
 * (os fantasmas antigos eram PNGs em base64 dentro do arquivo).
 */
export function paginaPublicado(jogador: DadosJogador, p: PartidaSalva, url: string): Html {
  const { login } = jogador;
  const quando = dataExtenso(p.data);
  const corpo = html`<p class="voltar"><a href="${urlPartida(login, p.data)}">‹ Partida de ${quando}</a></p>
<h1>Como foi publicado em ${quando}</h1>
<p class="apoio">O banner que apareceu no README de ${login} neste dia, gerado pela versão do jogo daquela época. Os números da partida neste site foram recalculados com as regras de hoje e podem ser diferentes.</p>
<div class="cartao"><img src="${url}" alt="Banner publicado no perfil de ${login} em ${quando}" width="1166" height="229" class="partida-svg"></div>
<p><a href="${url}">Abrir o arquivo original</a></p>`;
  return layout({ titulo: `${login} em ${quando}, como foi publicado`, corpo });
}
