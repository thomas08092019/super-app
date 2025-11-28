@echo off
REM My Super App - Windows Startup Script

echo.
echo =======================================
echo    My Super App - Startup Script
echo =======================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo [WARNING] .env file not found!
    echo.
    echo Creating .env file...
    echo.
    (
        echo # Database Configuration
        echo DB_NAME=superapp
        echo DB_USER=postgres
        echo DB_PASSWORD=postgres
        echo DB_HOST=db
        echo DB_PORT=5432
        echo.
        echo # Redis Configuration
        echo REDIS_URL=redis://redis:6379/0
        echo.
        echo # JWT Configuration
        echo JWT_SECRET=super-secret-jwt-key-change-this-in-production-12345
        echo JWT_ALGORITHM=HS256
        echo JWT_EXPIRATION_HOURS=24
        echo.
        echo # Application Settings
        echo ALLOW_REGISTRATION=False
        echo DEBUG=True
        echo.
        echo # Google Gemini API
        echo GEMINI_API_KEY=your-gemini-api-key-here
    ) > .env
    
    echo [SUCCESS] .env file created!
    echo.
    echo [WARNING] Please edit .env file and set your GEMINI_API_KEY
    echo           Get your key from: https://makersuite.google.com/app/apikey
    echo.
    pause
)

echo.
echo [INFO] Building and starting containers...
echo.

REM Stop existing containers
docker-compose down 2>nul

REM Build and start containers
docker-compose up --build -d

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start services. Check the logs.
    pause
    exit /b 1
)

echo.
echo [INFO] Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo =======================================
echo    Services Started Successfully!
echo =======================================
echo.
echo [WEB] Access the application:
echo       Frontend:  http://localhost:5173
echo       Backend:   http://localhost:8000
echo       API Docs:  http://localhost:8000/docs
echo.
echo [KEY] Default Login Credentials:
echo       Admin:  admin@example.com / admin123
echo       User:   user@example.com / user123
echo.
echo [CMD] Useful commands:
echo       View logs:     docker-compose logs -f
echo       Stop services: docker-compose down
echo       Restart:       docker-compose restart
echo.
echo Happy automating! 🎉
echo.
pause

