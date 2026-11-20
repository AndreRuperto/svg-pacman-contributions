import fetch from 'node-fetch';
import { ContributionLevel, Contribution, StoreType } from '../types.js';
import { getCurrentTheme, gridWindow, levelToIndex } from '../utils/utils.js';

/* ────────────────────────── Tipagens ────────────────────────── */
interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
  contributionLevel: ContributionLevel;
}

interface GraphQLResponse {
  data?: {
    rateLimit?: RateLimit;
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: {
            contributionDays: ContributionDay[];
          }[];
        };
      };
    } | null;
  };
}

/** Saldo da API GraphQL do GitHub. */
export interface RateLimit {
  remaining: number;
  resetAt: string;
}

/** Subconjunto de `fetch` usado aqui; permite injetar um falso nos testes. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const QUERY = /* GraphQL */ `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    rateLimit { remaining resetAt }
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
              color
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

const todayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * Contribuições da janela do gráfico de um dia (AAAA-MM-DD, UTC) e o saldo da API.
 * `color` vem vazio: quem desenha aplica o tema.
 * Erros: `USUARIO_NAO_ENCONTRADO` e `GITHUB_<status>`.
 */
export async function fetchContributionsWindow(
  login: string,
  date: string,
  token: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<{ contributions: Contribution[]; rateLimit: RateLimit }> {
  const variables = {
    login,
    from: gridWindow(date).start.toISOString(),
    to: `${date}T23:59:59Z`
  };

  const response = await fetchImpl('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: QUERY, variables })
  });

  if (!response.ok) throw new Error(`GITHUB_${response.status}`);

  const json = (await response.json()) as GraphQLResponse;
  const user = json.data?.user;
  if (!user) throw new Error('USUARIO_NAO_ENCONTRADO');

  const contributions = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((week) => week.contributionDays)
    .map((d) => ({
      date: new Date(d.date),
      count: d.contributionCount,
      color: '',
      level: d.contributionLevel
    }));

  return {
    contributions,
    rateLimit: json.data?.rateLimit ?? { remaining: 0, resetAt: '' }
  };
}

/* ─────────────────────── Função da Action ───────────────────── */
export async function fetchGithubContributionsGraphQL(
  store: StoreType,
  username: string,
  token: string
): Promise<Contribution[]> {
  const { contributions } = await fetchContributionsWindow(username, store.config.date ?? todayUTC(), token);
  const theme = getCurrentTheme(store);
  return contributions.map((c) => ({ ...c, color: theme.intensityColors[levelToIndex(c.level)] }));
}
