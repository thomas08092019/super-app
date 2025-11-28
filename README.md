# My Super App - Personal Telegram OSINT & Automation Center

A high-performance, containerized web application for Telegram management, data mining, and AI summarization.

## Features

- 🔐 **Authentication & RBAC** - JWT-based auth with role-based access control
- 📱 **Multi-Account Telegram** - Manage multiple Telegram sessions via Pyrogram
- 📡 **Real-time Message Feed** - Live WebSocket stream of all incoming messages
- 🤖 **AI Summarization** - Context-aware summarization using Google Gemini
- 💾 **Data Downloader** - Bulk download media with real-time progress tracking
- 🔍 **OSINT Tools** - Profile lookup and group analysis
- 📢 **Broadcaster** - Send messages to multiple users/groups safely

## Tech Stack

- **Backend**: Python FastAPI (Async)
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL (asyncpg)
- **Task Queue**: Redis + Celery
- **Telegram**: Pyrogram (MTProto)
- **AI**: Google Gemini API
- **Styling**: Tailwind CSS + Framer Motion

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository>
   cd my-supper-app
   cp .env.example .env
   ```

2. **Configure Environment**
   Edit `.env` and set:
   - `JWT_SECRET` - Strong random secret
   - `GEMINI_API_KEY` - Your Google Gemini API key

3. **Launch with Docker**
   ```bash
   docker-compose up --build
   ```

4. **Access the App**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Default Credentials

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

**User Account:**
- Email: `user@example.com`
- Password: `user123`

⚠️ **Change these passwords immediately in production!**

## Project Structure

```
my-supper-app/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── models.py         # Database models
│   │   ├── auth.py           # Authentication logic
│   │   ├── dependencies.py   # Dependency injection
│   │   ├── telegram_service.py
│   │   ├── celery_worker.py
│   │   └── routers/
│   ├── seed.py               # Database seeding
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## Development

- Backend runs with hot-reload on port 8000
- Frontend runs with Vite HMR on port 5173
- PostgreSQL on port 5432
- Redis on port 6379

## License

Private/Personal Use

