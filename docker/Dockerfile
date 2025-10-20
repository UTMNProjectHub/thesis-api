FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lock .

RUN apt-get update && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN bun install

COPY src src
COPY proto proto
COPY tsconfig.json .
# COPY public public
#
RUN bunx drizzle-kit generate
RUN bunx drizzle-kit migrate
RUN bun run db:fill

ENV NODE_ENV production
CMD ["bun", "src/index.ts"]
