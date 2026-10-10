# Birdie as one password-protected web app: the server serves the built app and the API.
# Run with BIRDIE_PASSWORD and ANTHROPIC_API_KEY set (see README, "Put it online").
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production BIRDIE_HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["npm", "run", "start", "-w", "server"]
