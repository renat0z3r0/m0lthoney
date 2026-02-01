FROM node:20-slim
RUN apt-get update && apt-get install -y avahi-daemon dbus && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p data/attacks data/ws-sessions data/cdp-sessions
EXPOSE 18789 18791 18793 41892
CMD ["node", "src/index.js"]
