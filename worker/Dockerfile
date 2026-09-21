FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY worker ./worker
COPY lib ./lib
COPY tsconfig.json ./
RUN pnpm exec tsc --outDir dist --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --skipLibCheck worker/index.ts
FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/worker/index.js"]
