/** Commits do SVG publicado de um jogador (API REST do GitHub). */

export interface CommitPublicado {
  /** AAAA-MM-DD (UTC) do commit. */
  date: string;
  sha: string;
}

export interface ListPublishedOptions {
  /** AAAA-MM-DD: só commits a partir deste dia. */
  since?: string;
  fetchImpl?: typeof fetch;
  /** Limite de páginas de 100 commits (padrão 30). */
  maxPages?: number;
}

const API = 'https://api.github.com/';
const TIMEOUT_MS = 15_000;

const segmentos = (s: string) => s.split('/').map(encodeURIComponent).join('/');

function proximaPagina(link: string | null): string | null {
  const m = link?.match(/<([^>]+)>\s*;\s*rel="next"/);
  return m && m[1].startsWith(API) ? m[1] : null;
}

interface CommitApi {
  sha?: unknown;
  commit?: { committer?: { date?: unknown } | null } | null;
}

/**
 * Lista os commits que mexeram em `path` na `branch` de `repo`, um por dia (UTC):
 * quando vários caem no mesmo dia, fica o mais recente. Ordem: data decrescente.
 * Repositório vazio (409) devolve `[]`; outros erros lançam `GITHUB_<status>`.
 */
export async function listPublished(
  repo: string,
  branch: string,
  path: string,
  token: string,
  opts: ListPublishedOptions = {}
): Promise<CommitPublicado[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxPages = opts.maxPages ?? 30;
  let url: string | null =
    `${API}repos/${segmentos(repo)}/commits?sha=${encodeURIComponent(branch)}&path=${segmentos(path)}&per_page=100` +
    (opts.since ? `&since=${opts.since}T00:00:00Z` : '');

  const porDia = new Map<string, { quando: number; sha: string }>();
  for (let pagina = 0; url && pagina < maxPages; pagina++) {
    const res: Response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'svg-pacman-ranking'
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (res.status === 409) return [];
    if (!res.ok) throw new Error(`GITHUB_${res.status}`);
    const commits = (await res.json()) as CommitApi[];
    if (!Array.isArray(commits)) throw new Error('GITHUB_RESPOSTA_INVALIDA');
    for (const c of commits) {
      const iso = c.commit?.committer?.date;
      if (typeof c.sha !== 'string' || typeof iso !== 'string') continue;
      const quando = Date.parse(iso);
      if (Number.isNaN(quando)) continue;
      const dia = new Date(quando).toISOString().slice(0, 10);
      const atual = porDia.get(dia);
      if (!atual || quando > atual.quando) porDia.set(dia, { quando, sha: c.sha });
    }
    url = proximaPagina(res.headers.get('link'));
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, { sha }]) => ({ date, sha }));
}
