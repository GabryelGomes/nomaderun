// `window.matchMedia` para o react-native-reanimated na web (reduzir movimento): o jsdom não implementa.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
