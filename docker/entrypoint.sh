#!/bin/sh
set -e

echo "Running database migrations..."
bunx drizzle-kit migrate

echo "Starting application..."
exec "$@"
