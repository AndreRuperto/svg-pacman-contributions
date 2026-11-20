/** Datas sempre AAAA-MM-DD em UTC. */

/** `true` se `s` é uma data AAAA-MM-DD que existe no calendário. */
export function dataValida(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Soma `n` dias a uma data AAAA-MM-DD, em UTC. */
export function addDays(date: string, n: number): string {
  if (!dataValida(date)) throw new Error(`data inválida: ${JSON.stringify(date)} (esperado AAAA-MM-DD)`);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lança se `hoje` não for uma data AAAA-MM-DD válida. */
export function exigirHoje(hoje: unknown): asserts hoje is string {
  if (!dataValida(hoje)) throw new Error(`"hoje" deve ser uma data AAAA-MM-DD válida (${JSON.stringify(hoje)})`);
}

/**
 * Último dia completo em UTC (a véspera de hoje). O site trabalha com ele:
 * o dia corrente ainda pode ganhar contribuições, então nunca é jogado.
 */
export function ultimoDiaCompleto(agora: Date = new Date()): string {
  return addDays(agora.toISOString().slice(0, 10), -1);
}
