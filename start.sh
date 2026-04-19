#!/bin/bash
set -e

# Wait for database to be available
echo "Checking database connection..."
npx prisma db push --accept-data-loss 2>&1 || {
  echo "WARNING: Database push failed, retrying in 5s..."
  sleep 5
  npx prisma db push --accept-data-loss
}

echo "Starting MindShift on port $PORT..."
exec next start -p ${PORT:-3000}