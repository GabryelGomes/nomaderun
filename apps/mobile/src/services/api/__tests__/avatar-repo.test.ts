import { describe, expect, it } from '@jest/globals';

import { base64ToBytes } from '@/features/screens/avatar-picker';

import { AVATAR_MAX_BYTES, avatarPath, validateAvatar } from '../avatar-repo';

describe('foto de perfil (P-03)', () => {
  it('aceita só JPEG/PNG/WebP até 2 MB', () => {
    expect(validateAvatar({ mimeType: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateAvatar({ mimeType: 'image/webp' })).toBeNull();
    expect(validateAvatar({ mimeType: 'image/gif', size: 10 })).toMatch(/JPEG, PNG ou WebP/);
    expect(validateAvatar({ mimeType: null })).not.toBeNull();
    expect(validateAvatar({ mimeType: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toMatch(/2 MB/);
  });

  it('grava na pasta do próprio usuário (policy do bucket avatars)', () => {
    expect(avatarPath('u-1', 'image/png', 42)).toBe('u-1/avatar-42.png');
    expect(avatarPath('u-1', 'image/jpeg', 42)).toBe('u-1/avatar-42.jpg');
  });

  it('decodifica base64 sem depender de atob', () => {
    expect(Array.from(base64ToBytes('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='))).toEqual(Array.from({ length: 32 }, (_, i) => i));
    expect(new TextDecoder().decode(base64ToBytes('TWFu'))).toBe('Man');
    expect(new TextDecoder().decode(base64ToBytes('TWE='))).toBe('Ma');
    expect(new TextDecoder().decode(base64ToBytes('data:image/png;base64,TQ=='))).toBe('M');
  });
});
