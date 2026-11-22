import type { Contribution, ContributionLevel } from '../../src/types.js';

/**
 * Registro compacto da janela do calendário usada para jogar o dia.
 * Não inclui SVG, token nem dados privados: apenas data, quantidade e nível
 * informados pelo GitHub para cada célula pública.
 */
export type ReplaySnapshot = [dia: string, quantidade: number, nivel: ContributionLevel][];

const NIVEIS: ReadonlySet<string> = new Set([
  'NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'
]);
const MAX_DIAS = 400;

const diaValido = (dia: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(dia) &&
  !Number.isNaN(Date.parse(`${dia}T00:00:00Z`)) &&
  new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10) === dia;

/** Normaliza os dados ANTES da partida, sem consultar a API novamente. */
export function guardarSnapshot(contribuicoes: Contribution[]): ReplaySnapshot {
  if (contribuicoes.length > MAX_DIAS) throw new Error('SNAPSHOT_EXCEDE_JANELA');
  const seen = new Set<string>();
  return contribuicoes.map((c) => {
    if (!(c.date instanceof Date) || Number.isNaN(c.date.getTime()))
      throw new Error('SNAPSHOT_DATA_INVALIDA');
    const dia = c.date.toISOString().slice(0, 10);
    if (seen.has(dia)) throw new Error('SNAPSHOT_DIA_DUPLICADO');
    seen.add(dia);
    if (!Number.isSafeInteger(c.count) || c.count < 0 || !NIVEIS.has(c.level))
      throw new Error('SNAPSHOT_CELULA_INVALIDA');
    return [dia, c.count, c.level];
  });
}

/** Valida inclusive dados antigos lidos do JSONB antes de passá-los ao motor. */
export function recuperarSnapshot(valor: unknown): Contribution[] {
  if (!Array.isArray(valor) || valor.length > MAX_DIAS) throw new Error('SNAPSHOT_INVALIDO');
  const seen = new Set<string>();
  return valor.map((item) => {
    if (!Array.isArray(item) || item.length !== 3) throw new Error('SNAPSHOT_INVALIDO');
    const [dia, count, level] = item as unknown[];
    if (typeof dia !== 'string' || !diaValido(dia) || seen.has(dia) ||
        !Number.isSafeInteger(count) || (count as number) < 0 ||
        typeof level !== 'string' || !NIVEIS.has(level))
      throw new Error('SNAPSHOT_INVALIDO');
    seen.add(dia);
    return { date: new Date(`${dia}T00:00:00Z`), count: count as number, color: '', level: level as ContributionLevel };
  });
}
