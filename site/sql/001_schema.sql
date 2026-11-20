-- Partidas do ranking. A chave é o login em minúsculas (login_key), para que
-- "Ana" e "ana" nunca virem dois jogadores; "login" guarda a grafia da lista.
CREATE TABLE IF NOT EXISTS partidas (
  login_key text NOT NULL,
  login text NOT NULL,
  data date NOT NULL,
  pontos integer NOT NULL,
  fantasmas integer NOT NULL,
  mortes integer NOT NULL,
  maior_combo integer NOT NULL,
  quadros integer NOT NULL,
  celulas integer NOT NULL,
  eficiencia double precision NOT NULL,
  interrompida boolean NOT NULL DEFAULT false,
  versao_motor text NOT NULL,
  publicado_sha text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (login_key, data),
  CHECK (login_key = lower(login))
);
CREATE INDEX IF NOT EXISTS partidas_data ON partidas (data);

-- Dias em que a janela não tinha nenhuma contribuição (playDay devolveu null).
-- Assim o cron não busca esses dias de novo a cada rodada; muda a versão, tenta de novo.
CREATE TABLE IF NOT EXISTS dias_sem_jogo (
  login_key text NOT NULL,
  data date NOT NULL,
  versao_motor text NOT NULL,
  PRIMARY KEY (login_key, data)
);
