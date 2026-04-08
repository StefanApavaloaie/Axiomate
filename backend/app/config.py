from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    #app
    APP_NAME: str = "Axiomate"
    DEBUG: bool = False
    SECRET_KEY: str

    #postgresql

    DATABASE_URL: str

    # async url
    SYNC_DATABASE_URL: str

    # SYNC url

    # REDIS
    REDIS_URL: str = "redis://localhost:6379/0"

    #celery

    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"


    # google auth

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"


    # jwt

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7


    #OLLAMA

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"


    #CACHE TTL's
    CACHE_TTL_OVERVIEW: int = 600 #10 minute
    CACHE_TTL_FUNNEL: int = 1800 # 30 minute
    CACHE_TTL_RETENTION: int = 3600 # 1 ora
    CACHE_TTL_ANOMALIES: int = 3600 # 1 ora
    CACHE_TTL_APIKEY: int = 300 # 5 minute

    #CORS

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173"
    ]
    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        case_sensitive = True,
    )

settings = Settings()