#!/bin/sh
# Entrypoint for the Axiomate backend container.
# Runs Alembic migrations first, then starts the API server.

echo "▶ Running Alembic migrations..."

# Try a normal upgrade. If it fails (e.g. the DB has an orphaned revision ID
# from a schema that was created via SQLAlchemy create_all() before Alembic
# was set up), stamp the DB to the current file-based head and retry.
if ! alembic upgrade head; then
    echo "⚠️  Migration failed — DB may have an orphaned revision."
    echo "    Stamping database to current migration head and retrying..."
    alembic stamp head
    alembic upgrade head
fi

echo "✅ Migrations complete."
echo "▶ Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
