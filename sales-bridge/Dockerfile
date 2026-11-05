FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm install --no-audit --no-fund tsx@4
COPY src ./src
ENV NODE_ENV=production PORT=3900
USER node
EXPOSE 3900
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3900/health || exit 1
CMD ["npx", "tsx", "src/index.ts"]
