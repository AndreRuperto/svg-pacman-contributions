import { DELTA_TIME, MONTHS } from '../../../src/core/constants.js';
import type { ThemeKeys } from '../../../src/types.js';
import type { Publicado } from '../jogadores.js';

/** `2026-11-20` → `20 nov. 2026`. */
export function dataExtenso(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${Number(dia)} ${MONTHS[Number(mes) - 1]} ${ano}`;
}

/** Quadros de 200 ms → `3m 01s` (ou `45s`, abaixo de um minuto). */
export function duracao(quadros: number): string {
  const s = Math.round((quadros * DELTA_TIME) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
}

export const inteiro = (n: number): string => Math.round(n).toLocaleString('pt-BR');

export const decimal = (n: number): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

const segmentos = (s: string) => s.split('/').map(encodeURIComponent).join('/');

/** O SVG como foi publicado naquele commit. */
export const urlPublicado = (pub: Publicado, sha: string): string =>
  `https://raw.githubusercontent.com/${segmentos(pub.repo)}/${encodeURIComponent(sha)}/${segmentos(pub.path)}`;

export const urlJogador = (login: string): string => `/jogador/${encodeURIComponent(login)}`;
export const urlPartida = (login: string, data: string): string => `${urlJogador(login)}/${data}`;
/** Página do site que mostra o SVG publicado (o raw do GitHub, aberto direto, bloqueia as imagens embutidas nele). */
export const urlPaginaPublicado = (login: string, data: string): string => `${urlPartida(login, data)}/publicado`;
export const urlAvatar = (login: string, tamanho: number): string =>
  `https://github.com/${encodeURIComponent(login)}.png?size=${tamanho}`;

export const REPO_URL = 'https://github.com/AndreRuperto/svg-pacman-contributions';
export const EDITAR_LISTA_URL = `${REPO_URL}/edit/main/ranking/jogadores.json`;

export const NOMES_TEMAS: Record<ThemeKeys, string> = {
  github: 'GitHub claro',
  'github-dark': 'GitHub escuro',
  brasa: 'Brasa',
  arcade: 'Fliperama',
  neon: 'Neon',
  'alto-contraste': 'Alto contraste',
  gitlab: 'GitLab claro',
  'gitlab-dark': 'GitLab escuro'
};
