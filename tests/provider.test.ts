import { describe, it, expect } from 'vitest';
import { fetchContributionsWindow, type FetchLike } from '../src/providers/github-contributions.js';

const ok = (json: unknown, status = 200) => ({ ok: status < 400, status, json: async () => json });

const resposta = {
  data: {
    rateLimit: { remaining: 4321, resetAt: '2026-11-20T15:00:00Z' },
    user: { contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: [
      { date: '2025-06-15', contributionCount: 2, color: '#40c463', contributionLevel: 'SECOND_QUARTILE' }
    ] }] } } }
  }
};

describe('fetchContributionsWindow', () => {
  it('envia from/to da janela do dia e devolve contribuições e saldo', async () => {
    let body: { variables: Record<string, string> } = { variables: {} };
    const fake: FetchLike = async (_url, init) => { body = JSON.parse(init.body); return ok(resposta); };
    const r = await fetchContributionsWindow('ana', '2025-06-15', 'tok', fake);
    expect(body.variables.to).toBe('2025-06-15T23:59:59Z');
    // Domingo de ~1 ano antes, sem passar de 1 ano (limite do contributionsCollection).
    expect(body.variables.from.slice(0, 10)).toBe('2024-06-16');
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0].level).toBe('SECOND_QUARTILE');
    expect(r.rateLimit.remaining).toBe(4321);
  });
  it('usuário inexistente vira erro com código', async () => {
    const fake: FetchLike = async () => ok({ data: { user: null, rateLimit: { remaining: 10, resetAt: '' } } });
    await expect(fetchContributionsWindow('nao-existe-xyz', '2025-06-15', 'tok', fake)).rejects.toThrow('USUARIO_NAO_ENCONTRADO');
  });
  it('resposta HTTP de erro vira erro com o status', async () => {
    const fake: FetchLike = async () => ok({}, 502);
    await expect(fetchContributionsWindow('ana', '2025-06-15', 'tok', fake)).rejects.toThrow('GITHUB_502');
  });
  it('erro NOT_FOUND do GraphQL vira USUARIO_NAO_ENCONTRADO', async () => {
    const fake: FetchLike = async () => ok({
      data: { user: null, rateLimit: { remaining: 10, resetAt: '' } },
      errors: [{ type: 'NOT_FOUND', message: "Could not resolve to a User with the login of 'x'." }]
    });
    await expect(fetchContributionsWindow('x', '2025-06-15', 'tok', fake)).rejects.toThrow('USUARIO_NAO_ENCONTRADO');
  });
  it('outros erros do GraphQL (HTTP 200) viram GITHUB_GRAPHQL com a mensagem', async () => {
    const fake: FetchLike = async () => ok({
      data: { user: null },
      errors: [{ message: "The total time spanned by 'from' and 'to' must not exceed 1 year" }]
    });
    await expect(fetchContributionsWindow('ana', '2025-06-15', 'tok', fake))
      .rejects.toThrow("GITHUB_GRAPHQL: The total time spanned by 'from' and 'to' must not exceed 1 year");
  });
  it('sem rateLimit na resposta, o saldo vem nulo', async () => {
    const semSaldo = { data: { user: resposta.data.user } };
    const r = await fetchContributionsWindow('ana', '2025-06-15', 'tok', async () => ok(semSaldo));
    expect(r.rateLimit).toBeNull();
  });
});
