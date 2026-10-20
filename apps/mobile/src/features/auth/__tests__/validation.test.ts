import { describe, expect, it } from '@jest/globals';

import {
  ageOn,
  validateCity,
  hasErrors,
  maskBirthdate,
  parseBirthdate,
  passwordStrength,
  validateBirthdate,
  validateEmail,
  validatePassword,
  validateSignUp,
  validateUsername,
} from '../validation';

const today = new Date(2026, 9, 20); // 20/10/2026

describe('idade mínima de 16 anos (RF-001)', () => {
  it('16 anos completos no dia do aniversário', () => {
    expect(validateBirthdate('20/10/2010', today)).toBeNull();
    expect(ageOn('2010-10-20', today)).toBe(16);
  });

  it('um dia antes de completar 16 é recusado', () => {
    expect(validateBirthdate('21/10/2010', today)).toMatch(/16 anos/);
    expect(ageOn('2010-10-21', today)).toBe(15);
  });

  it('datas inválidas, futuras e absurdas', () => {
    expect(validateBirthdate('', today)).toMatch(/Informe/);
    expect(validateBirthdate('31/02/2000', today)).toMatch(/inválida/);
    expect(validateBirthdate('2000-01-01', today)).toMatch(/inválida/);
    expect(validateBirthdate('01/01/2030', today)).toMatch(/futuro/);
    expect(validateBirthdate('01/01/1890', today)).toMatch(/ano/);
  });

  it('máscara e conversão para ISO', () => {
    expect(maskBirthdate('1')).toBe('1');
    expect(maskBirthdate('1005')).toBe('10/05');
    expect(maskBirthdate('10052000999')).toBe('10/05/2000');
    expect(maskBirthdate('10/05/2000')).toBe('10/05/2000');
    expect(parseBirthdate('10/05/2000')).toBe('2000-05-10');
    expect(parseBirthdate('29/02/2001')).toBeNull();
    expect(parseBirthdate('29/02/2000')).toBe('2000-02-29');
  });
});

describe('nome de usuário (3–20)', () => {
  it.each(['ana', 'maria_corre', 'joao.silva', 'A1234567890123456789'])('aceita %s', (u) => expect(validateUsername(u)).toBeNull());
  it.each(['ab', 'a'.repeat(21), 'com espaço', 'joão', 'ana!'])('recusa %s', (u) => expect(validateUsername(u)).not.toBeNull());
  it('ignora espaços nas pontas', () => expect(validateUsername('  ana  ')).toBeNull());
});

describe('senha (mín. 8 com feedback)', () => {
  it('curta demais diz quantos faltam', () => {
    expect(passwordStrength('abc')).toMatchObject({ ok: false, level: 0, hint: 'Faltam 5 caracteres.' });
    expect(passwordStrength('abcdefg').hint).toBe('Faltam 1 caractere.');
    expect(passwordStrength('').ok).toBe(false);
    expect(validatePassword('1234567')).not.toBeNull();
  });

  it('níveis fraca, média e forte', () => {
    expect(passwordStrength('abcdefgh')).toMatchObject({ ok: true, level: 1 });
    expect(passwordStrength('Abcdefg1')).toMatchObject({ ok: true, level: 2 });
    expect(passwordStrength('abcdefgh1234')).toMatchObject({ ok: true, level: 2 });
    expect(passwordStrength('Abcdefgh1234!')).toMatchObject({ ok: true, level: 3 });
    expect(validatePassword('12345678')).toBeNull();
  });
});

describe('e-mail e formulário completo', () => {
  it('e-mail', () => {
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('ana@')).not.toBeNull();
    expect(validateEmail(' ana@ex.com ')).toBeNull();
  });

  it('exige os dois aceites separados', () => {
    const base = { email: 'a@b.com', password: '12345678', username: 'ana', birthdate: '01/01/2000', acceptedTerms: true, acceptedPrivacy: true };
    expect(hasErrors(validateSignUp(base, today))).toBe(false);
    expect(validateSignUp({ ...base, acceptedTerms: false }, today)).toEqual({ acceptedTerms: expect.any(String) });
    expect(validateSignUp({ ...base, acceptedPrivacy: false }, today)).toEqual({ acceptedPrivacy: expect.any(String) });
    expect(Object.keys(validateSignUp({ email: '', password: '', username: '', birthdate: '', acceptedTerms: false, acceptedPrivacy: false }, today))).toHaveLength(6);
  });
});

describe('cidade natal no cadastro', () => {
  it('é opcional; se vier, 2 a 80 caracteres como no banco', () => {
    expect(validateCity('')).toBeNull();
    expect(validateCity('   ')).toBeNull();
    expect(validateCity(undefined)).toBeNull();
    expect(validateCity('G')).toMatch(/2 letras/);
    expect(validateCity(' Goiânia ')).toBeNull();
    expect(validateCity('x'.repeat(81))).toMatch(/80/);
  });
});
