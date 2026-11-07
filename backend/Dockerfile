FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY backend ./backend
EXPOSE 8788
CMD ["sh", "-c", "node backend/migrate.cjs && node backend/mmorpg-server.cjs"]
