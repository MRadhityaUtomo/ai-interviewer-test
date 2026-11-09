# Development image shared by the app, reverb, queue and vite services.
# Kept small on purpose (instead of the full Sail runtime): fewer apt downloads,
# and apt goes over HTTPS, which works on networks that block plain HTTP mirrors.
FROM php:8.4-cli-bookworm

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/

# Node.js for Vite
COPY --from=node:24-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && install-php-extensions pdo_pgsql pgsql redis intl zip pcntl bcmath opcache \
    && apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

COPY php.ini /usr/local/etc/php/conf.d/99-app.ini

WORKDIR /var/www/html
EXPOSE 80

# --no-reload keeps the container's env (e.g. DB_HOST=pgsql) for the served
# process; without it artisan serve drops non-passthrough variables.
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=80", "--no-reload"]
