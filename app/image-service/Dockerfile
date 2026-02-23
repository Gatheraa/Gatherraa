FROM node:18-bullseye-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libvips42 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["node", "index.js"]
