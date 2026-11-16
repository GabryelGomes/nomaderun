# NOMADE RUN — como abrir no celular usando Docker

Você só precisa de **Docker** no computador e do **Expo Go** no celular. Não precisa instalar Node, Android Studio nem nada do projeto.

## 1. Instale (só na primeira vez)

- **Computador:** Docker Desktop (Windows ou Mac, em docker.com) ou Docker Engine (Linux). No Windows, deixe o Docker Desktop aberto antes de continuar.
- **Celular:** Expo Go, pela Play Store ou App Store.

## 2. Rode o projeto

1. Extraia o zip e abra um terminal **dentro da pasta `nomaderun`** (a que tem o arquivo `docker-compose.yml`).
   - Windows: abra a pasta no Explorador, clique na barra de endereço, digite `powershell` e aperte Enter.
2. Rode:

   ```
   docker compose up --build
   ```

   A primeira vez leva de 5 a 10 minutos, porque baixa as dependências. Nas próximas é rápido.
3. Quando aparecer o **QR code** no terminal (e a linha `Tunnel ready`), escaneie:
   - **Android:** abra o Expo Go e toque em **Scan QR code**.
   - **iPhone:** aponte a câmera e toque em "Abrir no Expo Go".

A primeira abertura no celular demora alguns segundos, porque o computador monta o app. Funciona em qualquer rede (Wi-Fi ou 4G), porque o Expo usa um túnel.

**Para parar:** `Ctrl + C` no terminal. **Para rodar de novo:** `docker compose up`.

## 3. Modo do app

Por padrão o app abre em **modo demonstração**: dados fictícios (marcados como "Demonstração"), sem servidor e sem criar conta de verdade. É o jeito mais simples de testar todas as telas.

Para usar o **servidor da nuvem** (contas e corridas de verdade), crie um arquivo chamado `.env` dentro da pasta `nomaderun`, ao lado do `docker-compose.yml`, com as linhas abaixo (os autores passam a chave):

```
EXPO_PUBLIC_DEMO=0
EXPO_PUBLIC_SUPABASE_URL=https://rbdxksunpfbaxkelnsob.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<chave pública enviada pelos autores>
```

Depois rode `docker compose up --build` de novo.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `docker: command not found` ou "Cannot connect to the Docker daemon" | Instale o Docker e deixe o Docker Desktop aberto. |
| O QR code não aparece ou o túnel falha (`ngrok`) | Tente de novo em 1 minuto. Se continuar, use a rede local: com o celular no **mesmo Wi-Fi** do computador, descubra o IP do computador (`ipconfig` no Windows) e rode `docker compose run --service-ports -e REACT_NATIVE_PACKAGER_HOSTNAME=SEU_IP app npx expo start --lan`. |
| Expo Go diz que o projeto é incompatível (SDK) | O app usa o Expo SDK 57. No Android, instale o Expo Go para o SDK 57 em expo.dev/go. |
| Tela "Backend não configurado" | O `.env` está com `EXPO_PUBLIC_DEMO=0`, mas sem a URL ou a chave. Complete o arquivo ou apague-o para voltar ao modo demonstração. |
| Mudou o `.env` e nada mudou no app | Pare com `Ctrl + C` e rode `docker compose up --build`. |
