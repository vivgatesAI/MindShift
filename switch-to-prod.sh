#!/bin/bash
# Switch Prisma schema for production (PostgreSQL)
# Run this before deploying to Railway

cp prisma/schema.production.prisma prisma/schema.prisma
echo "Switched to PostgreSQL schema for production"