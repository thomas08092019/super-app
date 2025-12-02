from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/superapp"
    REDIS_URL: str = "redis://redis:6379/0"
    JWT_SECRET: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    ALLOW_REGISTRATION: bool = False
    DEBUG: bool = True
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]
    
    # MinIO Internal (Docker Network)
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "superapp-media"
    MINIO_SECURE: bool = False

    # MinIO External (Browser Access)
    MINIO_PUBLIC_ENDPOINT: str = "localhost:9000"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()