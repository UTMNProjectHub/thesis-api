FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lock .

RUN apt-get update && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN bun install

COPY prisma prisma
COPY src src
COPY tsconfig.json .
# COPY public public

RUN bun prisma generate

ENV NODE_ENV production
CMD ["bun", "src/index.ts"]