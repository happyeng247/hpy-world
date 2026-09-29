FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.* ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/var/data/becoming
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /var/data/becoming && chown -R node:node /var/data/becoming /app
USER node
EXPOSE 4173
CMD ["node", "server/index.mjs"]
