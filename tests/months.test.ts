import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeStore } from './helpers.js';
import { buildMonthLabels } from '../src/utils/utils.js';
import { MONTHS } from '../src/core/constants.js';

afterEach(() => vi.restoreAllMocks());

describe('meses do banner', () => {
  it('saem em português mesmo num sistema em inglês (runner do GitHub)', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('Dec');
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Dec');
    const store = makeStore();
    buildMonthLabels(store);
    const labels = store.monthLabels.filter(Boolean);
    expect(labels.length).toBeGreaterThanOrEqual(12);
    for (const l of labels) expect(MONTHS).toContain(l);
  });
  it('nomes abreviados com ponto, como no gráfico em português', () => {
    expect(MONTHS).toEqual(['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']);
  });
});
