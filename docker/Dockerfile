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
COPY drizzle drizzle
COPY tsconfig.json .
COPY drizzle.config.ts .
COPY docker/entrypoint.sh /entrypoint.sh
# COPY public public

RUN chmod +x /entrypoint.sh

ENV NODE_ENV production
ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "src/index.ts"]
