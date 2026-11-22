/** Entradas públicas da GitHub Action: validação antes de gerar ou gravar arquivos. */
const THEMES = ['github', 'github-dark', 'brasa', 'arcade', 'neon', 'alto-contraste', 'gitlab', 'gitlab-dark'] as const;
const STYLES = ['oportunista', 'agressivo', 'conservador'] as const;

export function validarUsuarioGitHub(texto: string): string {
  const usuario = texto.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(usuario)) {
    throw new Error('github_user_name inválido: use o login do GitHub (1–39 caracteres, letras, números e hífen)');
  }
  return usuario;
}

export function validarTema(texto: string): string {
  if (!THEMES.includes(texto as (typeof THEMES)[number])) {
    throw new Error(`theme inválido: use ${THEMES.join(', ')}`);
  }
  return texto;
}

export function validarEstilo(texto: string): string {
  if (!STYLES.includes(texto as (typeof STYLES)[number])) {
    throw new Error(`player_style inválido: use ${STYLES.join(', ')}`);
  }
  return texto;
}

export function validarVelocidade(texto: string): string | number {
  if (texto === 'slow' || texto === 'normal' || texto === 'fast') return texto;
  // Evita zero, NaN, infinito e velocidades arbitrariamente altas ou baixas.
  const n = Number(texto);
  if (!texto.trim() || !Number.isFinite(n) || n < 0.25 || n > 3) {
    throw new Error('speed inválido: use slow, normal, fast ou número de 0.25 a 3');
  }
  return n;
}
