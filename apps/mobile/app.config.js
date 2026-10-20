// Configuração dinâmica sobre o app.json (que continua sendo a fonte principal).
// GPS em segundo plano (D-10) só é ligado em development build, com a variável
// de ambiente NOMADE_BACKGROUND_LOCATION=1 no momento do build/prebuild:
//   NOMADE_BACKGROUND_LOCATION=1 npx expo run:android
// No Expo Go a flag não tem efeito (o Expo Go não grava GPS em segundo plano no iOS).
// O app lê o valor em tempo de execução por expo-constants: Constants.expoConfig.extra.backgroundLocation.
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
  return { ...config, plugins, extra: { ...config.extra, backgroundLocation: background } };
};
