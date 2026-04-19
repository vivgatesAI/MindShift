#!/bin/bash
set -e

echo "=== MindShift Startup ==="
echo "DATABASE_URL is set: ${DATABASE_URL:+YES}"
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | cut -c1-30)..."

# Wait for database connection and push schema
echo "Pushing database schema..."
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma db push --accept-data-loss 2>&1; then
    echo "Database schema pushed successfully!"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Database push failed (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 5s..."
    sleep 5
  fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "WARNING: Could not push database schema after $MAX_RETRIES attempts. Starting anyway..."
fi

echo "Starting MindShift on port ${PORT:-3000}..."
exec npx next start -p ${PORT:-3000} --hostname 0.0.0.0