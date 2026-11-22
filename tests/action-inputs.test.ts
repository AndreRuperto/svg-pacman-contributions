import { describe, expect, it } from 'vitest';
import {
  validarEstilo,
  validarTema,
  validarUsuarioGitHub,
  validarVelocidade
} from '../src/utils/action-inputs.js';

describe('entradas da GitHub Action', () => {
  it('reconhece nomes GitHub válidos e rejeita nomes perigosos', () => {
    expect(validarUsuarioGitHub(' AndreRuperto ')).toBe('AndreRuperto');
    expect(validarUsuarioGitHub('abc-123')).toBe('abc-123');
    for (const login of ['', '-user', 'user-', 'a/b', 'a\nINJECT', 'a'.repeat(40)]) {
      expect(() => validarUsuarioGitHub(login)).toThrow(/github_user_name inválido/);
    }
  });

  it('não aceita temas ou estilos desconhecidos', () => {
    for (const tema of ['github-dark', 'github', 'brasa', 'arcade', 'neon', 'alto-contraste', 'gitlab', 'gitlab-dark']) {
      expect(validarTema(tema)).toBe(tema);
    }
    expect(() => validarTema('desconhecido')).toThrow(/theme inválido/);
    for (const estilo of ['oportunista', 'agressivo', 'conservador']) {
      expect(validarEstilo(estilo)).toBe(estilo);
    }
    expect(() => validarEstilo('fantasma')).toThrow(/player_style inválido/);
  });

  it('limita a velocidade para evitar tempos sem sentido', () => {
    expect(validarVelocidade('slow')).toBe('slow');
    expect(validarVelocidade('normal')).toBe('normal');
    expect(validarVelocidade('fast')).toBe('fast');
    expect(validarVelocidade('1.5')).toBe(1.5);
    expect(validarVelocidade('0.25')).toBe(0.25);
    expect(validarVelocidade('3')).toBe(3);
    for (const speed of ['0', '0.01', '-1', '', ' ', '9', 'Infinity', 'NaN']) {
      expect(() => validarVelocidade(speed)).toThrow(/speed inválido/);
    }
  });
});
