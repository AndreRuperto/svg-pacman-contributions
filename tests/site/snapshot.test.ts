import { describe, expect, it } from 'vitest';
import type { Contribution } from '../../src/types.js';
import { guardarSnapshot, recuperarSnapshot } from '../../site/src/snapshot.js';

const entrada: Contribution[] = [
  { date: new Date('2026-11-18T00:00:00Z'), count: 3, color: '', level: 'SECOND_QUARTILE' },
  { date: new Date('2026-11-19T00:00:00Z'), count: 0, color: '', level: 'NONE' },
  { date: new Date('2026-11-20T00:00:00Z'), count: 25, color: '', level: 'FOURTH_QUARTILE' }
];

describe('snapshot reprodutível do GitHub', () => {
  it('mantém datas, quantidades e níveis sem incluir SVG nem cores do tema', () => {
    const snapshot = guardarSnapshot(entrada);
    expect(snapshot).toEqual([
      ['2026-11-18', 3, 'SECOND_QUARTILE'],
      ['2026-11-19', 0, 'NONE'],
      ['2026-11-20', 25, 'FOURTH_QUARTILE']
    ]);
    expect(recuperarSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(entrada);
  });

  it('recusa valores adulterados e datas duplicadas', () => {
    expect(() => recuperarSnapshot([['2026-02-30', 1, 'FIRST_QUARTILE']])).toThrow('SNAPSHOT_INVALIDO');
    expect(() => recuperarSnapshot([['2026-11-19', -1, 'NONE']])).toThrow('SNAPSHOT_INVALIDO');
    expect(() => recuperarSnapshot([['2026-11-19', 1, 'DUPLO']])).toThrow('SNAPSHOT_INVALIDO');
    expect(() => recuperarSnapshot([['2026-11-19', 0, 'NONE'], ['2026-11-19', 0, 'NONE']]))
      .toThrow('SNAPSHOT_INVALIDO');
    expect(() => recuperarSnapshot({ date: '2026-11-19' })).toThrow('SNAPSHOT_INVALIDO');
  });

  it('impede guardar dias duplicados e contagens não inteiras', () => {
    expect(() => guardarSnapshot([entrada[0], { ...entrada[0] }])).toThrow('SNAPSHOT_DIA_DUPLICADO');
    expect(() => guardarSnapshot([{ ...entrada[0], count: 1.5 }])).toThrow('SNAPSHOT_CELULA_INVALIDA');
  });

  it('aceita janela vazia sem confundi-la com snapshot ausente (null)', () => {
    expect(guardarSnapshot([])).toEqual([]);
    expect(recuperarSnapshot([])).toEqual([]);
  });
});
