# syntax=docker/dockerfile:1
#
# Host-agnostic production image. Runtime config (DATABASE_URL, JWT_SECRET, PORT)
# comes from the environment; see deploy/ for the compose stack that wires it up.

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim

# Prisma's engines need openssl.
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

WORKDIR /app
RUN chown node:node /app
USER node

# Dependencies first, so this layer is cached until the lockfile changes.
COPY --chown=node:node package.json pnpm-lock.yaml ./

# `prisma generate` only needs the variable to exist; the real URL is a runtime secret.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/webhookrelay"

# Devdependencies stay: `prisma` (for `migrate deploy`) lives there.
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .

# Next inlines NEXT_PUBLIC_* at build time, so it must be a build arg.
# Use the public origin without a trailing slash, e.g. https://relay.example.com
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

RUN pnpm run build

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
CMD ["pnpm", "run", "start"]
