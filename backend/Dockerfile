FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY dist ./dist
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
