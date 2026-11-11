# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js/Prisma"

WORKDIR /app

ENV NODE_ENV="production"

# Pin the pnpm 10 line. `latest` now fails the image build on unapproved
# dependency scripts (ERR_PNPM_IGNORED_BUILDS).
ARG PNPM_VERSION=10
RUN npm install -g pnpm@$PNPM_VERSION


FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY package.json pnpm-lock.yaml ./

# prisma generate only needs the env var to exist. The real URL is a runtime secret.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/webhookrelay"

# Approve the install scripts pnpm 10 blocks by default. esbuild is required
# by `tsx` at startup; Prisma needs its engine download.
RUN printf '%s\n' \
      'onlyBuiltDependencies:' \
      '  - "@prisma/client"' \
      '  - "@prisma/engines"' \
      '  - esbuild' \
      '  - prisma' \
      '  - sharp' \
      '  - unrs-resolver' \
      > pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# Next inlines this at build time. Pass it as a Fly build arg.
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

RUN pnpm run build

# Keep devDependencies. `prisma` is one of them, and Fly's release command
# runs `npx prisma migrate deploy` in this image.


FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build /app /app

EXPOSE 8080
CMD [ "pnpm", "run", "start" ]