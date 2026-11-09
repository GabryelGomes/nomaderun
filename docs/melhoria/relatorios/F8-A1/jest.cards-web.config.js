/**
 * F8 · A1 — a mesma configuração da E8 (`../E8/jest.cards-web.config.js`) mais o `matchMedia` que o
 * react-native-reanimated pede na web (o jsdom não tem). Só para gerar o SVG dos cards com o emblema novo.
 * Uso (em apps/mobile): NOMADE_CARDS_OUT=<saída> npx jest --config ../../docs/melhoria/relatorios/F8-A1/jest.cards-web.config.js
 * Depois: NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E8/rasterizar-cards.cjs <saída>
 */
const base = require('../E8/jest.cards-web.config.js');

module.exports = { ...base, setupFiles: [__dirname + '/jest.web-setup.js'] };
