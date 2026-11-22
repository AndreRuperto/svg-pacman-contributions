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
  return html`<div class="tile partida-metrica"><p class="tile-rotulo">${rotulo}</p><p class="tile-valor">${valor}</p></div>`;
}

export function paginaPartida({
  jogador, partida: p, tema, temaPadrao, podeDesenhar = true, snapshotDisponivel = false
}: PartidaPagina): Html {
  const { login } = jogador;
  // As partidas vêm ordenadas por data decrescente: pulamos dias sem partida.
  const i = jogador.partidas.findIndex((x) => x.data === p.data);
  const seguinte = jogador.partidas[i - 1]?.data;
  const anterior = jogador.partidas[i + 1]?.data;
  const sufixo = tema === temaPadrao ? '' : `?tema=${tema}`;
  const quando = dataExtenso(p.data);
  const urlSvg = `/api/partida/${encodeURIComponent(login)}/${p.data}?tema=${tema}`;
  const possuiOriginal = Boolean(jogador.publicado && p.publicado_sha);

  // O HTML conhece a existência do snapshot, mas NÃO consegue antecipar o
  // resultado HTTP da imagem. Só a rota /api/partida valida o replay e,
  // quando responde 200, envia X-Pacman-Replay: verificado|reconstrucao.
  // Portanto, nunca chamar um SVG de "verificado" somente pela existência do snapshot.
  const integridade = !podeDesenhar
    ? html`<div class="partida-integridade partida-integridade-off" role="status">
      <strong>Animação indisponível</strong>
      <p>A partida e o placar continuam registrados, mas este servidor não consegue gerar o SVG.</p>
    </div>`
    : snapshotDisponivel
      ? html`<div class="partida-integridade partida-integridade-origem">
        <strong>Dados originais preservados</strong>
        <p>A verificação ocorre durante a geração da animação. Se o placar divergir ou o motor for incompatível, a API não entrega o replay.</p>
      </div>`
      : html`<div class="partida-integridade partida-integridade-historica">
        <strong>Reconstrução histórica</strong>
        <p>O calendário original não foi guardado. A animação usa as contribuições atuais do GitHub e pode diferir do placar registrado.${possuiOriginal ? ' Consulte também o banner original abaixo.' : ''}</p>
      </div>`;

  const corpo = html`<div class="partida-pagina">
<p class="voltar partida-voltar"><a href="${urlJogador(login)}">‹ ${login}</a></p>
<header class="partida-cabecalho">
  <div class="dia-nav">
    ${seta(anterior, 'Dia anterior', '‹', login, sufixo)}
    <h1><span class="sr">${login}, </span>${quando}</h1>
    ${seta(seguinte, 'Dia seguinte', '›', login, sufixo)}
  </div>
  <p class="apoio partida-cabecalho-ajuda">Navegue entre as partidas registradas. Os dias sem jogo são pulados.</p>
</header>
<section class="partida-secao-arena" aria-labelledby="partida-arena-titulo">
  <div class="partida-secao-topo">
    <h2 id="partida-arena-titulo">Animação da partida</h2>
    <p class="apoio">Tema: ${NOMES_TEMAS[tema]}</p>
  </div>
  ${integridade}
  ${podeDesenhar
    ? html`<div class="cartao palco partida-palco">
        <img src="${urlSvg}" alt="Partida de ${login} em ${quando}" width="1166" height="229" class="partida-svg" decoding="async">
      </div>
      <p class="apoio partida-aviso-svg">Se a animação não carregar, <a href="${urlSvg}">abra o SVG diretamente</a> para consultar a resposta do servidor. Um erro de verificação não altera o placar abaixo.</p>`
    : html`<p class="cartao vazio partida-indisponivel">A animação não está disponível neste servidor.</p>`}
</section>
${podeDesenhar
  ? html`<section class="partida-opcoes" aria-label="Personalizar animação">
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
    </form>
  </section>`
  : ''}
${p.interrompida
  ? html`<p class="cartao aviso partida-aviso-limite">Partida interrompida no limite de quadros: conta no dia e nos 7 dias, mas fica fora do recorde.</p>`
  : ''}
<section class="partida-secao-placar" aria-labelledby="partida-placar-titulo">
  <div class="partida-secao-topo">
    <h2 id="partida-placar-titulo">Placar registrado</h2>
    <p class="apoio">Dados da partida armazenados no ranking</p>
  </div>
  <div class="tiles tiles-6 partida-placar-grade">
    ${stat('Pontos', inteiro(p.pontos))}
    ${stat('Eficiência', decimal(p.eficiencia))}
    ${stat('Fantasmas', String(p.fantasmas))}
    ${stat('Maior combo', `×${p.maior_combo}`)}
    ${stat('Mortes', String(p.mortes))}
    ${stat('Duração', duracao(p.quadros))}
  </div>
</section>
${possuiOriginal
  ? html`<aside class="partida-publicado">
      <div>
        <h2>Banner original do dia</h2>
        <p class="apoio">Veja a versão publicada no perfil do GitHub naquela data, que pode ter usado outro motor ou tema.</p>
      </div>
      <a class="botao botao-sec" href="${urlPaginaPublicado(login, p.data)}">Ver como foi publicado neste dia</a>
    </aside>`
  : ''}
</div>`;
  return layout({ titulo: `${login} em ${quando}`, corpo, modo: 'partida' });
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
