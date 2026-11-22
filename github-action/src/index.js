const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const { PacmanRenderer } = require('../../src/index.ts');
const { validarUsuarioGitHub, validarTema, validarEstilo, validarVelocidade } = require('../../src/utils/action-inputs.ts');

async function generateSvg(username, token, theme, playerStyle, animationSpeed) {
  return new Promise((resolve, reject) => {
    let generatedSvg = '';

    const config = {
      platform: 'github',
      username,
      gameTheme: theme,
      outputFormat: 'svg',
      gameSpeed: 1,
      githubSettings: { accessToken: token },
      playerStyle,
      animationSpeed,
      svgCallback: (svg) => {
        generatedSvg = svg;
      },
      gameOverCallback: () => {
        resolve(generatedSvg);
      }
    };

    try {
      const renderer = new PacmanRenderer(config);
      Promise.resolve(renderer.start()).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function run() {
  try {
    const username = validarUsuarioGitHub(core.getInput('github_user_name', { required: true }));
    const token = core.getInput('github_token', { required: true });
    core.setSecret(token);
    const selectedTheme = validarTema(core.getInput('theme') || 'github-dark');
    const outputDir = core.getInput('output_directory') || 'dist';
    const caminho = path.resolve(process.cwd(), outputDir);
    const relativo = path.relative(process.cwd(), caminho);
    if (path.isAbsolute(outputDir) || relativo === '..' || relativo.startsWith('..' + path.sep)) {
      throw new Error('output_directory deve apontar para uma pasta dentro do workspace');
    }
    const playerStyle = validarEstilo(core.getInput('player_style') || 'oportunista');
    const animationSpeed = validarVelocidade(core.getInput('speed') || 'normal');

    fs.mkdirSync(caminho, { recursive: true });

    console.log(`🟡 Gerando SVG para o tema: ${selectedTheme}`);
    const svg = await generateSvg(username, token, selectedTheme, playerStyle, animationSpeed);
    if (!svg || !svg.trimStart().startsWith('<svg')) throw new Error('O renderizador não produziu um SVG válido');
    // github → sem sufixo; github-dark → -dark (nomes antigos mantidos); demais temas → -<tema>
    const sufixo = { github: '', 'github-dark': '-dark' }[selectedTheme] ?? `-${selectedTheme}`;
    const fileName = `pacman-contribution-graph${sufixo}.svg`;
    const fullPath = path.join(caminho, fileName);
    fs.writeFileSync(fullPath, svg);
    console.log(`✅ SVG salvo em: ${fullPath}`);

    core.setOutput('svg', svg);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();