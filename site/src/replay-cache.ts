import { createHash } from 'node:crypto';
import type { PartidaSalva } from './repo.js';
import type { ReplaySnapshot } from './snapshot.js';

/**
 * A assinatura muda se qualquer dado capaz de alterar o replay mudar.
 * O tema faz parte da chave do repositório, mas não da assinatura do placar.
 * Não confundir com autenticação ou assinatura criptográfica de usuário.
 */
export function assinaturaReplay(partida: PartidaSalva, snapshot: ReplaySnapshot): string {
  const conteudo = [
    'replay-cache-v1',
    partida.login.toLowerCase(),
    partida.data,
    partida.versao_motor,
    partida.pontos,
    partida.fantasmas,
    partida.mortes,
    partida.maior_combo,
    partida.quadros,
    partida.celulas,
    partida.eficiencia,
    partida.interrompida,
    snapshot
  ];
  return createHash('sha256').update(JSON.stringify(conteudo)).digest('hex');
}

/** Evita encher a base com SVGs enormes e facilita manter a RAM controlada. */
export const MAX_SVG_BYTES = 12 * 1024 * 1024;
export const MAX_GZIP_BYTES = 2 * 1024 * 1024;
export const MAX_CACHE_DAYS = 30;

export function cacheavel(svg: string): boolean {
  return svg.startsWith('<svg') && Buffer.byteLength(svg, 'utf8') <= MAX_SVG_BYTES;
}
