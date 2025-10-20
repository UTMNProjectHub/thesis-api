#!/bin/sh
set -e

echo "Running database migrations..."
bunx drizzle-kit migrate

echo "Filling database with initial data..."
bun run db:fill || echo "Database fill failed or already completed"

echo "Starting application..."
exec "$@"
