# NOMADE RUN — protótipo do app

App de corrida de rua com as funções essenciais de um app de corrida e uma Arena de minigames sobre o mapa real da cidade (Domínio de território, Neblina, Fuga, Caça, Raid). Feito com **Expo SDK 57 + React Native + TypeScript**.

## Rodar no celular (Expo Go, sem instalar Android Studio nem Xcode)

1. Instale o app **Expo Go** no celular (App Store ou Google Play).
2. No computador, com Node.js 22+:
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```
3. Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android). Celular e computador precisam estar na mesma rede Wi-Fi.

No iPhone o mapa é o Apple Maps; no Android, o Google Maps. Para testar sem sair de casa, escolha **Simulação** na tela de nova corrida: o app percorre uma volta no Parque Flamboyant (Goiânia) em velocidade 10×.

## Rodar no navegador

```bash
npx expo start --web
```

O mapa da web usa MapLibre com o mapa base gratuito do OpenFreeMap.

## Testes e qualidade

```bash
npm test            # 53 testes das regras de negócio (src/domain)
npm run typecheck   # TypeScript
npm run lint        # ESLint com as regras do React Compiler
```

Os testes cobrem as regras do ERS com valores-limite: pontuação com esforço relativo (RN-001), conquista com histerese (RN-002), ataque e defesa (RN-003), escudo (RN-004), decaimento e temporada (RN-005, RN-006), antifraude de GPS e passos (RN-007, RN-008), Índice de Confiança (RN-009), Guerra de Cidades (RN-013), Neblina, Fuga, Caça, Liga do Bairro, sequência semanal e progressão.

## Estrutura

```
src/
  app/          rotas (Expo Router): abas nativas, corrida, resumo, zona, onboarding
  domain/       regras do jogo, puras e testadas (sem React)
  features/     telas e a sessão de corrida (GPS ou simulação)
  components/   UI reutilizável: mapa nativo/web, botões, hexágono com hachura
  theme/        design system "Asfalto & Giz"
  store/        estado do jogo (Zustand)
  demo/         dados de DEMONSTRAÇÃO (não são usuários reais)
```

## O que é protótipo e o que muda na produção

| Parte | Protótipo | Produção |
|---|---|---|
| Mapa | `react-native-maps` (roda no Expo Go) | Mapbox (`@rnmapbox/maps`) com vector tiles e feature-state |
| GPS | `expo-location` com o app aberto | Serviço de localização em segundo plano |
| Dados | Estado local + dados de demonstração | Supabase (Postgres + PostGIS, Realtime, Edge Functions) |
| Passos | Só na simulação | Pedômetro do aparelho (RN-008) |
| SOS e Escolta | Simulados na tela | Envio real para os contatos |
