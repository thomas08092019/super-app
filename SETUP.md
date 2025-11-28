# Setup Guide - My Super App

## Prerequisites

- Docker and Docker Compose installed
- Git installed
- At least 4GB of available RAM
- Ports 5173, 8000, 5432, 6379 available

## Quick Start

### 1. Clone and Setup

```bash
# Navigate to project directory
cd my-supper-app

# Create .env file from example
# Copy the contents from .env.example and modify as needed
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with the following:

```env
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

# Google Gemini API (Get yours from: https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your-gemini-api-key-here
```

### 3. Launch the Application

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 5. Default Login Credentials

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

**User Account:**
- Email: `user@example.com`
- Password: `user123`

⚠️ **IMPORTANT**: Change these passwords immediately in production!

## Service Details

### Backend (FastAPI)
- Port: 8000
- Auto-reloads on code changes
- Database seeding runs automatically on startup

### Frontend (React + Vite)
- Port: 5173
- Hot Module Replacement (HMR) enabled
- Tailwind CSS for styling

### Database (PostgreSQL)
- Port: 5432
- Persistent volume: `postgres_data`
- Automatically creates tables on first run

### Redis
- Port: 6379
- Used for Celery task queue

### Celery Worker
- Handles background tasks
- Downloads and broadcasts

## Telegram Setup

### Getting Telegram API Credentials

1. Go to https://my.telegram.org
2. Log in with your phone number
3. Go to "API Development Tools"
4. Create a new application
5. Copy your `api_id` and `api_hash`

### Adding a Telegram Account

1. Log in to the Super App
2. Navigate to **Telegram → Accounts**
3. Click **Add Account**
4. Enter:
   - Session Name (any unique name)
   - Phone Number (with country code, e.g., +1234567890)
   - API ID (from my.telegram.org)
   - API Hash (from my.telegram.org)
5. Click **Send Code**
6. Enter the OTP code sent to your Telegram app
7. If 2FA is enabled, enter your 2FA password

## Features Usage

### 1. Dashboard
- Overview of your Telegram sessions
- Quick access to main features
- Activity monitoring

### 2. User Management (Admin Only)
- View all users
- Ban/Unban users
- Reset passwords
- Delete accounts

### 3. Telegram Accounts
- Add multiple Telegram sessions
- Manage active sessions
- Remove accounts

### 4. Live Feed
- Real-time message stream from all connected accounts
- View messages across all chats
- WebSocket-based updates

### 5. AI Summary
- Select a Telegram session
- Choose time range
- Optionally filter by specific chat
- Generate AI-powered summary using Google Gemini

### 6. Data Miner
- Bulk download media files
- Select media types (photos, videos, documents)
- Real-time progress tracking in terminal-style UI
- Downloads saved to `media/` volume

### 7. OSINT Tools
- **Profile Lookup**: Get detailed user information
  - User ID, username, bio
  - Phone number (if accessible)
  - Data center location
  - Common chats count
- **Group Lookup**: Analyze groups and channels
  - Member count
  - Admins list
  - Group description
  - Verification status

### 8. Broadcaster
- Send messages to multiple chats
- Configurable delays to avoid flood bans
- Real-time progress tracking
- Safe sending with random delays

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
docker-compose logs backend

# Rebuild backend
docker-compose up -d --build backend
```

### Database Connection Issues
```bash
# Check if database is healthy
docker-compose ps

# Restart database
docker-compose restart db
```

### Frontend Not Loading
```bash
# Check logs
docker-compose logs frontend

# Rebuild frontend
docker-compose up -d --build frontend
```

### Celery Worker Issues
```bash
# Check logs
docker-compose logs celery_worker

# Restart worker
docker-compose restart celery_worker
```

## Development

### Backend Development

```bash
# Enter backend container
docker exec -it superapp_backend bash

# Run migrations (if using Alembic)
alembic upgrade head

# Access Python shell
python
```

### Frontend Development

```bash
# Enter frontend container
docker exec -it superapp_frontend sh

# Install new package
npm install <package-name>

# Rebuild
npm run build
```

### Database Management

```bash
# Access PostgreSQL
docker exec -it superapp_db psql -U postgres -d superapp

# View tables
\dt

# Query users
SELECT * FROM users;
```

## Production Deployment

### Security Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change default admin and user passwords
- [ ] Set `DEBUG=False`
- [ ] Set `ALLOW_REGISTRATION=False` (unless needed)
- [ ] Use strong database password
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Review CORS settings
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging

### Environment Variables for Production

```env
DEBUG=False
ALLOW_REGISTRATION=False
JWT_SECRET=<generate-strong-random-secret-256-bit>
DB_PASSWORD=<strong-database-password>
GEMINI_API_KEY=<your-production-gemini-key>
```

### Backup Database

```bash
# Backup
docker exec superapp_db pg_dump -U postgres superapp > backup.sql

# Restore
docker exec -i superapp_db psql -U postgres superapp < backup.sql
```

## API Documentation

Access the interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Architecture

```
┌─────────────────┐
│   Frontend      │  React + TypeScript + Vite
│   (Port 5173)   │  Tailwind CSS + Framer Motion
└────────┬────────┘
         │ HTTP/WebSocket
┌────────▼────────┐
│   Backend       │  FastAPI (Async)
│   (Port 8000)   │  Pyrogram + Celery
└────┬───────┬────┘
     │       │
     │       └────────┐
┌────▼────┐      ┌───▼────┐
│PostgreSQL│      │ Redis  │
│  (5432) │      │ (6379) │
└─────────┘      └────────┘
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review this setup guide
3. Check the API documentation
4. Ensure all environment variables are set correctly

## License

Private/Personal Use

---

**Happy Automating! 🚀**

