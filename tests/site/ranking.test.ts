import { describe, it, expect } from 'vitest';
import { rankPlayers } from '../../site/src/ranking.js';
import type { Partida } from '../../src/runner.js';

const p = (login: string, data: string, pontos: number, celulas = 100, mortes = 0, interrompida = false): Partida =>
  ({ login, data, pontos, fantasmas: 0, mortes, maior_combo: 0, quadros: 900, celulas, eficiencia: pontos / celulas, interrompida, versao_motor: '1.1.0' });

const jogos = [
  p('ana', '2026-11-20', 900), p('bia', '2026-11-20', 900, 50, 2), p('caio', '2026-11-20', 500, 10),
  p('ana', '2026-11-19', 5000, 100, 0, true), p('bia', '2026-11-14', 9000), p('caio', '2026-11-15', 100, 10)
];

describe('rankPlayers', () => {
  it('hoje por pontos, empate desfeito por menos mortes e depois login', () => {
    expect(rankPlayers(jogos, { aba: 'pontos', periodo: 'hoje', hoje: '2026-11-20' }).map(r => r.login)).toEqual(['ana', 'bia', 'caio']);
  });
  it('hoje por eficiência', () => {
    expect(rankPlayers(jogos, { aba: 'eficiencia', periodo: 'hoje', hoje: '2026-11-20' }).map(r => r.login)).toEqual(['caio', 'bia', 'ana']);
  });
  it('7 dias = média das partidas de hoje-6 a hoje', () => {
    const r = rankPlayers(jogos, { aba: 'pontos', periodo: '7d', hoje: '2026-11-20' });
    expect(r.find(x => x.login === 'caio')!.valor).toBe(300);
    expect(r.find(x => x.login === 'bia')!.valor).toBe(4950);
  });
  it('recorde ignora partida interrompida', () => {
    const r = rankPlayers(jogos, { aba: 'pontos', periodo: 'recorde', hoje: '2026-11-20' });
    expect(r.find(x => x.login === 'ana')!.valor).toBe(900);
    expect(r[0].login).toBe('bia');
  });
  it('posições numeradas a partir de 1', () => {
    expect(rankPlayers(jogos, { aba: 'pontos', periodo: 'hoje', hoje: '2026-11-20' }).map(r => r.posicao)).toEqual([1, 2, 3]);
  });
});
