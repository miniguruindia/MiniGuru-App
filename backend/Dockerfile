FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY dist /app/dist
RUN ls -la /app/dist && echo "dist copy verified"
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "/app/dist/index.js"]
