/**
 * Gera a logo do site (direção "A · Mordida na grade" da prancha) em SVG e PNG.
 *   pnpm exec tsx tools/gerar-logo.ts
 * Grava em site/public/: logo.svg, favicon-32.png, apple-touch-icon.png (180) e og.png (1200×630).
 * Os PNGs vão versionados; rode de novo só se a logo mudar.
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Resvg } from '@resvg/resvg-js';

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

const celula = (x: number, y: number, cor: string) => `<path d="${rr(x, y, 14, 14, 3.5)}" fill="${cor}"/>`;

/** Grade 3×3 de contribuições com o Pac-Man no meio, mordendo a célula da direita. Sem o fundo. */
const MIOLO = [
  celula(7, 7, '#0e4429'), celula(25, 7, '#26a641'), celula(43, 7, '#006d32'),
  celula(7, 25, '#39d353'), celula(43, 25, '#26a641'),
  celula(7, 43, '#006d32'), celula(25, 43, '#0e4429'), celula(43, 43, '#39d353'),
  '<path d="M32 32 L40.5 26.5 A10.5 10.5 0 1 0 40.5 37.5 Z" fill="#FFD23F"/>'
].join('');

/** Logo com o fundo arredondado (favicon e cabeçalho). */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${rr(0, 0, 64, 64, 14)}" fill="#161A22"/>${MIOLO}</svg>`;

/** Ícone de tela inicial: fundo cheio (o sistema arredonda os cantos). */
const APPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#161A22"/>${MIOLO}</svg>`;

/** Prévia de link (og:image): logo + nome + frase, no fundo da identidade. */
const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0B0D12"/>
<g transform="translate(110 175) scale(4.375)"><path d="${rr(0, 0, 64, 64, 14)}" fill="#161A22"/>${MIOLO}</g>
<text x="440" y="300" font-family="Consolas, 'DejaVu Sans Mono', monospace" font-weight="700" font-size="76" fill="#FFD23F">SVG Pac-Man</text>
<text x="442" y="370" font-family="'Segoe UI', 'DejaVu Sans', Arial, sans-serif" font-size="36" fill="#E8EAF0">Seu ano de commits virou fase.</text>
<text x="442" y="430" font-family="'Segoe UI', 'DejaVu Sans', Arial, sans-serif" font-size="28" fill="#9AA3B2">Histórico de partidas e ranking entre jogadores</text>
</svg>`;

const png = (svg: string, largura: number) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: largura }, font: { loadSystemFonts: true } }).render().asPng();

const pasta = resolve('site/public');
writeFileSync(`${pasta}/logo.svg`, LOGO_SVG + '\n');
writeFileSync(`${pasta}/favicon-32.png`, png(LOGO_SVG, 32));
writeFileSync(`${pasta}/apple-touch-icon.png`, png(APPLE_SVG, 180));
writeFileSync(`${pasta}/og.png`, png(OG_SVG, 1200));
console.log('logo gerada em site/public/');
