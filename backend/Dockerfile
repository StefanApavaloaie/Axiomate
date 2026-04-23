FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies needed for building packages (e.g. psycopg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make the entrypoint script executable
RUN chmod +x start.sh

# Expose port
EXPOSE 8000

# Run migrations then start the API server.
# Celery containers override this CMD via docker-compose `command:`.
CMD ["sh", "start.sh"]
