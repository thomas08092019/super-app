#!/bin/bash

# Create migration if changes detected (auto-generate)
# Note: In production, you usually run this manually to verify
# For dev convenience, we attempt to generate and upgrade
echo "🔄 Checking for database changes..."

# Try to create a migration. If no changes, this might create an empty one (which is fine for dev) or skip
alembic revision --autogenerate -m "auto_migration" || true

# Apply migrations
echo "🚀 Running database migrations..."
alembic upgrade head

# Run seed data (it checks for existence first, so safe to run)
echo "🌱 Seeding database..."
python seed.py

# Start Server
echo "🔥 Starting Server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload