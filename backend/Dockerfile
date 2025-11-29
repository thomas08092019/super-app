FROM python:3.11

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/media /app/sessions /app/exports

# Set permissions
RUN chmod -R 777 /app/sessions /app/media /app/exports
# Make run script executable
RUN chmod +x /app/run.sh

EXPOSE 8000

CMD ["./run.sh"]