#!/bin/bash

# My Super App - Startup Script
# This script helps you start the application easily

set -e

echo "🚀 My Super App - Startup Script"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo ""
    echo "Creating .env file from .env.example..."
    
    cat > .env << 'EOF'
# Database Configuration
DB_NAME=superapp
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# JWT Configuration
JWT_SECRET=super-secret-jwt-key-change-this-in-production-12345
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Application Settings
ALLOW_REGISTRATION=False
DEBUG=True

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here
EOF
    
    echo "✅ .env file created!"
    echo ""
    echo "⚠️  Please edit .env file and set your GEMINI_API_KEY"
    echo "   Get your key from: https://makersuite.google.com/app/apikey"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to exit and edit .env..."
fi

echo ""
echo "📦 Building and starting containers..."
echo ""

# Stop any existing containers
docker-compose down 2>/dev/null || true

# Build and start containers
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "✅ All services started successfully!"
    echo ""
    echo "🌐 Access the application:"
    echo "   Frontend:  http://localhost:5173"
    echo "   Backend:   http://localhost:8000"
    echo "   API Docs:  http://localhost:8000/docs"
    echo ""
    echo "🔑 Default Login Credentials:"
    echo "   Admin:  admin@example.com / admin123"
    echo "   User:   user@example.com / user123"
    echo ""
    echo "📊 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop services:"
    echo "   docker-compose down"
    echo ""
    echo "Happy automating! 🎉"
else
    echo ""
    echo "❌ Some services failed to start. Check logs:"
    echo "   docker-compose logs"
    exit 1
fi

