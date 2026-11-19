const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const { PacmanRenderer } = require('../../src/index.ts');

async function generateSvg(username, token, theme, playerStyle, animationSpeed) {
  return new Promise((resolve) => {
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

    const renderer = new PacmanRenderer(config);
    renderer.start();
  });
}

async function run() {
  try {
    const username = core.getInput('github_user_name', { required: true });
    const token = core.getInput('github_token');
    const selectedTheme = core.getInput('theme') || 'github-dark';
    const outputDir = core.getInput('output_directory') || 'dist';
    const playerStyle = core.getInput('player_style') || 'oportunista';
    const speedInput = core.getInput('speed') || 'normal';
    const animationSpeed = Number.isFinite(Number(speedInput)) ? Number(speedInput) : speedInput;

    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`🟡 Gerando SVG para o tema: ${selectedTheme}`);
    const svg = await generateSvg(username, token, selectedTheme, playerStyle, animationSpeed);
    // github → sem sufixo; github-dark → -dark (nomes antigos mantidos); demais temas → -<tema>
    const sufixo = { github: '', 'github-dark': '-dark' }[selectedTheme] ?? `-${selectedTheme}`;
    const fileName = `pacman-contribution-graph${sufixo}.svg`;
    const fullPath = path.join(outputDir, fileName);
    fs.writeFileSync(fullPath, svg);
    console.log(`✅ SVG salvo em: ${fullPath}`);

    core.setOutput('svg', svg);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();