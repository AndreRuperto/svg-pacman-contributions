import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MemoryRepo, type PartidaRepo } from '../../site/src/repo.js';
import { PgRepo } from '../../site/src/repo-pg.js';
import type { Partida } from '../../src/runner.js';

const p = (login: string, data: string, pontos = 100, versao_motor = '1.1.0'): Partida => ({
  login, data, pontos, fantasmas: 1, mortes: 0, maior_combo: 2, quadros: 900, celulas: 50,
  eficiencia: pontos / 50, interrompida: false, versao_motor
});

function contrato(nome: string, criar: () => Promise<PartidaRepo>) {
  describe(`PartidaRepo: ${nome}`, () => {
    let repo: PartidaRepo;
    beforeEach(async () => { repo = await criar(); });

    it('upsert duas vezes não duplica e atualiza os números', async () => {
      await repo.upsert(p('ana', '2026-11-20', 100));
      await repo.upsert(p('ana', '2026-11-20', 300));
      const partidas = await repo.porJogador('ana');
      expect(partidas).toHaveLength(1);
      expect(partidas[0]).toMatchObject({ login: 'ana', data: '2026-11-20', pontos: 300, eficiencia: 6 });
    });

    it('a chave ignora maiúsculas e guarda a grafia da última gravação', async () => {
      await repo.upsert(p('ana', '2026-11-20', 100));
      await repo.upsert(p('Ana', '2026-11-20', 200));
      expect(await repo.porJogador('ANA')).toEqual([expect.objectContaining({ login: 'Ana', pontos: 200 })]);
      expect(await repo.datasExistentes('aNa', '1.1.0')).toEqual(new Set(['2026-11-20']));
      expect(await repo.entre('2026-11-20', '2026-11-20', ['ANA'])).toHaveLength(1);
      expect(await repo.todasDe(['ana'])).toHaveLength(1);
    });

    it('devolve todos os campos da partida, com data AAAA-MM-DD', async () => {
      await repo.upsert({ ...p('ana', '2026-11-20'), interrompida: true });
      const [lida] = await repo.porJogador('ana');
      expect(lida).toEqual({ ...p('ana', '2026-11-20'), interrompida: true, publicado_sha: null });
    });

    it('guarda só as colunas da partida (svg e campos a mais ficam de fora)', async () => {
      const extra = { ...p('ana', '2026-11-20'), svg: '<svg/>', qualquer: 1 } as Partida;
      await repo.upsert(extra);
      expect(await repo.porJogador('ana')).toEqual([{ ...p('ana', '2026-11-20'), publicado_sha: null }]);
    });

    it('snapshot de replay é preservado no banco sem contaminar o placar público', async () => {
      const janela = [
        ['2026-11-19', 3, 'SECOND_QUARTILE'],
        ['2026-11-20', 25, 'FOURTH_QUARTILE']
      ] as const;
      expect(await repo.obterSnapshot('Ana', '2026-11-20')).toBeNull();
      await repo.upsert({ ...p('Ana', '2026-11-20'), snapshot: janela.map((l) => [...l]) });
      expect(await repo.obterSnapshot('ana', '2026-11-20')).toEqual(janela);
      expect((await repo.porJogador('ana'))[0]).not.toHaveProperty('snapshot');

      // Mesmo que o chamador altere o array, a memória do repositório é isolada.
      const lido = await repo.obterSnapshot('ANA', '2026-11-20');
      expect(lido).not.toBeNull();
      if (lido) lido[0][1] = 999;
      expect((await repo.obterSnapshot('ana', '2026-11-20'))?.[0][1]).toBe(3);

      // Um replay reprocessado sem janela NÃO pode receber janela de outra partida.
      await repo.upsert(p('ana', '2026-11-20', 500));
      expect(await repo.obterSnapshot('ana', '2026-11-20')).toBeNull();
    });

    it('datasExistentes filtra pela versão', async () => {
      await repo.upsert(p('ana', '2026-11-19', 100, '1.0.0'));
      await repo.upsert(p('ana', '2026-11-20', 100, '1.1.0'));
      expect(await repo.datasExistentes('ana', '1.1.0')).toEqual(new Set(['2026-11-20']));
      expect(await repo.datasExistentes('ana', '1.0.0')).toEqual(new Set(['2026-11-19']));
      expect(await repo.datasExistentes('bia', '1.1.0')).toEqual(new Set());
    });

    it('entre respeita o intervalo (inclusivo) e os logins', async () => {
      for (const d of ['2026-11-13', '2026-11-14', '2026-11-20', '2026-11-21']) await repo.upsert(p('ana', d));
      await repo.upsert(p('bia', '2026-11-15'));
      await repo.upsert(p('caio', '2026-11-15'));
      const r = await repo.entre('2026-11-14', '2026-11-20', ['ana', 'bia']);
      expect(r.map((x) => `${x.login}|${x.data}`).sort()).toEqual(['ana|2026-11-14', 'ana|2026-11-20', 'bia|2026-11-15']);
      expect(await repo.entre('2026-11-14', '2026-11-20', [])).toEqual([]);
    });

    it('todasDe devolve só os logins pedidos', async () => {
      await repo.upsert(p('ana', '2026-11-20'));
      await repo.upsert(p('bia', '2026-11-19'));
      await repo.upsert(p('caio', '2026-11-18'));
      expect((await repo.todasDe(['ana', 'caio'])).map((x) => x.login).sort()).toEqual(['ana', 'caio']);
      expect(await repo.todasDe([])).toEqual([]);
    });

    it('porJogador vem em ordem de data decrescente', async () => {
      for (const d of ['2026-11-18', '2026-11-20', '2026-11-01', '2026-11-19']) await repo.upsert(p('ana', d));
      expect((await repo.porJogador('ana')).map((x) => x.data)).toEqual(['2026-11-20', '2026-11-19', '2026-11-18', '2026-11-01']);
    });

    it('marcarPublicado grava o sha, e um upsert sem sha não o apaga', async () => {
      await repo.upsert(p('ana', '2026-11-20'));
      await repo.marcarPublicado('ANA', '2026-11-20', 'abc');
      await repo.marcarPublicado('ana', '2026-11-01', 'zzz'); // sem partida: não faz nada
      expect((await repo.porJogador('ana'))[0].publicado_sha).toBe('abc');
      await repo.upsert(p('ana', '2026-11-20', 500));
      expect((await repo.porJogador('ana'))[0]).toMatchObject({ pontos: 500, publicado_sha: 'abc' });
      await repo.upsert({ ...p('ana', '2026-11-20'), publicado_sha: 'def' });
      expect((await repo.porJogador('ana'))[0].publicado_sha).toBe('def');
      expect(await repo.porJogador('ana')).toHaveLength(1);
    });

    it('dias sem jogo ficam registrados por versão', async () => {
      await repo.marcarSemJogo('Ana', '2026-11-10', '1.1.0');
      await repo.marcarSemJogo('ana', '2026-11-10', '1.1.0');
      await repo.marcarSemJogo('ana', '2026-11-09', '1.0.0');
      expect(await repo.diasSemJogo('ANA', '1.1.0')).toEqual(new Set(['2026-11-10']));
      expect(await repo.diasSemJogo('ana', '1.0.0')).toEqual(new Set(['2026-11-09']));
      expect(await repo.porJogador('ana')).toEqual([]);
    });
  });
}

contrato('memória', async () => new MemoryRepo());

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PgRepo (TEST_DATABASE_URL)', () => {
  let pg: PgRepo | undefined;
  afterAll(async () => { await pg?.close(); });
  contrato('Postgres', async () => {
    if (!pg) {
      pg = PgRepo.fromUrl(url!);
      await pg.migrate();
      await pg.migrate(); // idempotente
    }
    await pg.truncateForTests();
    return pg;
  });
});
