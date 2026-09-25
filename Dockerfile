# Two stages: the first one builds, the second one only carries static files and a web server. Nothing of
# Node, pnpm or the sources survives into the published image — what is served is a folder of files.
FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable

# Dependencies alone first: as long as the lockfile does not move, rebuilding after a change in `src/`
# skips the install entirely.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

# No variable is passed here on purpose. The address of the database is written at start-up, in `config.js`,
# so that the same image can serve any instance — see `docker-entrypoint.sh`.
RUN pnpm build

FROM nginx:1.27-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /docker-entrypoint.d/40-familist-config.sh

RUN chmod +x /docker-entrypoint.d/40-familist-config.sh

EXPOSE 80
