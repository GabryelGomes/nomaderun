# NOMADE RUN — servidor do Expo dentro do Docker, para abrir o app no celular pelo Expo Go.
# Uso: veja "COMO RODAR COM DOCKER.md" (resumo: docker compose up --build e escanear o QR code).
FROM node:22-bookworm-slim

ENV EXPO_NO_TELEMETRY=1 \
    NODE_ENV=development

# Túnel do Expo (deixa o celular abrir o app de qualquer rede, sem configurar IP, Wi-Fi ou firewall).
RUN npm install -g @expo/ngrok@4.1.3 --no-audit --no-fund

WORKDIR /app

# Dependências primeiro (camada em cache: só refaz quando o package-lock muda).
COPY apps/mobile/package.json apps/mobile/package-lock.json ./
COPY apps/mobile/scripts ./scripts
RUN npm ci --no-audit --no-fund

COPY apps/mobile/ ./

# Metro (porta do Expo). Com o túnel o celular não usa esta porta; ela serve para abrir a versão web no PC.
EXPOSE 8081

CMD ["npx", "expo", "start", "--tunnel"]
