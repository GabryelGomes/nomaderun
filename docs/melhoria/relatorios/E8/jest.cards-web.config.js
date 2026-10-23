/**
 * E8 · onda 1 — configuração do Jest só para gerar a evidência em PNG dos cards (não faz parte da suíte do app).
 * Renderiza os componentes reais com o react-native-svg da web (react-native-web) e grava o SVG de cada card.
 *
 * Uso (em apps/mobile):
 *   NOMADE_CARDS_OUT=/pasta/saida npx jest --config ../../docs/melhoria/relatorios/E8/jest.cards-web.config.js
 * Depois: NODE_PATH=/opt/node22/lib/node_modules node ../../docs/melhoria/relatorios/E8/rasterizar-cards.cjs /pasta/saida
 */
const path = require('path');

const appRoot = path.resolve(__dirname, '../../../../apps/mobile');

module.exports = {
  preset: 'jest-expo/web',
  rootDir: appRoot,
  roots: ['<rootDir>/src/features/social'],
  modulePaths: ['<rootDir>/node_modules'],
  testMatch: ['**/__tests__/gerar-svgs.web.tsx'],
  // O preset web do jest-expo troca as opções do babel-jest e perde o babel-preset-expo quando não há
  // babel.config.js (o app não tem): aqui ele volta explícito, com o caller da web.
  transform: {
    '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'], caller: { name: 'metro', bundler: 'metro', platform: 'web' } }],
  },
};
