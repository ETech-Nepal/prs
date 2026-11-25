FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

# Run as the built-in unprivileged user, not root.
USER node

ENV NODE_ENV=production
EXPOSE 4300

CMD ["node", "src/server.js"]
