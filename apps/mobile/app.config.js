// Configuração dinâmica sobre o app.json (que continua sendo a fonte principal).
//
// 1) GPS em segundo plano (D-10) só é ligado em development build, com a variável
// de ambiente NOMADE_BACKGROUND_LOCATION=1 no momento do build/prebuild:
//   NOMADE_BACKGROUND_LOCATION=1 npx expo run:android
// No Expo Go a flag não tem efeito (o Expo Go não grava GPS em segundo plano no iOS).
// O app lê o valor em tempo de execução por expo-constants: Constants.expoConfig.extra.backgroundLocation.
//
// 2) OTA (EAS Update, D-99): `updates.url` nasce de `extra.eas.projectId` (fonte única), no formato
// https://u.expo.dev/<projectId>. Enquanto o app.json tiver o marcador (antes do `eas init` na conta dos autores,
// supabase/DEPLOY.md §12), o projectId sai da configuração resolvida e o expo-updates fica desligado: o Expo Go e o
// `expo start` não tentam falar com um projeto que não existe, e o `npm run publicar`/`npm run apk` recusam
// (scripts/check-publicacao.js). Na web o expo-updates não faz nada.
const EAS_PROJECT_PLACEHOLDER = 'COLE-AQUI-O-PROJECT-ID-DO-EAS-INIT';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isEasProjectId(value) {
  return typeof value === 'string' && UUID.test(value);
}

function withUpdates(config) {
  const extra = config.extra ?? {};
  const eas = extra.eas ?? {};
  if (isEasProjectId(eas.projectId)) {
    return {
      ...config,
      updates: { ...config.updates, enabled: true, url: `https://u.expo.dev/${eas.projectId}` },
    };
  }
  const { projectId: _placeholder, ...easRest } = eas;
  const { url: _url, ...updatesRest } = config.updates ?? {};
  return { ...config, extra: { ...extra, eas: easRest }, updates: { ...updatesRest, enabled: false } };
}

module.exports = ({ config }) => {
  const background = process.env.NOMADE_BACKGROUND_LOCATION === '1';
  const plugins = (config.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-location') return plugin;
    return [
      'expo-location',
      {
        ...plugin[1],
        isIosBackgroundLocationEnabled: background,
        isAndroidBackgroundLocationEnabled: background,
        isAndroidForegroundServiceEnabled: background,
      },
    ];
  });
  return withUpdates({ ...config, plugins, extra: { ...config.extra, backgroundLocation: background } });
};

module.exports.EAS_PROJECT_PLACEHOLDER = EAS_PROJECT_PLACEHOLDER;
module.exports.isEasProjectId = isEasProjectId;
