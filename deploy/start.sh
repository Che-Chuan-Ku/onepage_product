#!/bin/bash
set -e

# Render provides $PORT; default to 10000
export PORT=${PORT:-10000}

# JVM memory tuning (Render free tier = 512MB)
export JVM_OPTS="${JVM_OPTS:--Xmx300m -Xms128m}"

# Generate nginx config from template (substitute $PORT)
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Construct Spring Boot datasource from Render DB env vars
if [ -n "$DB_HOST" ]; then
  export DB_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?sslmode=require"
  export DB_USERNAME="${DB_USER}"
  # DB_PASSWORD is passed through directly from Render
fi

# Start all services
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
