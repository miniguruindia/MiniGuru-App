FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build
RUN cp src/services/youtubeUploadService.js dist/services/youtubeUploadService.js

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
