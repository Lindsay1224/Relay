FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY worker ./worker
COPY lib ./lib
COPY tsconfig.json ./
RUN npx tsc --outDir dist --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --skipLibCheck worker/index.ts
FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/worker/index.js"]
