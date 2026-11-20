import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { EDITAR_LISTA_URL, REPO_URL } from './formato.js';

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

/** O CSS do site, lido uma vez; a URL leva o hash do conteúdo, então pode ter cache longo. */
export const CSS = readFileSync(new URL('../../public/site.css', import.meta.url), 'utf8');
export const CSS_HREF = `/static/site.css?v=${createHash('sha256').update(CSS).digest('hex').slice(0, 12)}`;

const FONTES =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;700' +
  '&family=Silkscreen:wght@700&family=Space+Grotesk:wght@700&display=swap';

export interface LayoutOpts {
  /** Vai antes de "· SVG Pac-Man" no `<title>`. */
  titulo: string;
  /** Link do cabeçalho marcado com `aria-current`. */
  atual?: 'ranking';
  corpo: Html;
}

export function layout({ titulo, atual, corpo }: LayoutOpts): Html {
  return html`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · SVG Pac-Man</title>
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0B0D12">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTES}">
<link rel="stylesheet" href="${CSS_HREF}">
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <div class="topo-dentro">
    <a class="marca" href="/">SVG Pac-Man</a>
    <nav aria-label="Principal">
      <ul class="topo-links">
        <li><a href="/"${atual === 'ranking' ? html` aria-current="page"` : ''}>Ranking</a></li>
        <li><a href="${EDITAR_LISTA_URL}">Como entrar</a></li>
        <li><a href="${REPO_URL}">GitHub</a></li>
      </ul>
    </nav>
  </div>
</header>
<main id="conteudo" class="pagina">
${corpo}
</main>
</body>
</html>`;
}

/** Página de erro (404, 500…) com um caminho de volta. */
export function paginaErro(titulo: string, mensagem: string): Html {
  return layout({
    titulo,
    corpo: html`<h1>${titulo}</h1>
<p class="sub">${mensagem}</p>
<p><a class="botao" href="/">Voltar ao ranking</a></p>`
  });
}
