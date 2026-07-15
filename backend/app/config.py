from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Job Agent"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/jobagent"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    
    # Job Scraping
    JOOBLE_API_KEY: str = ""
    FINDWORK_API_KEY: str = ""
    ADZUNA_APP_ID: str = ""
    ADZUNA_APP_KEY: str = ""
    USAJOBS_API_KEY: str = ""
    USAJOBS_EMAIL: str = ""
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"
    
    def validate_secret_key(self):
        """Validate that SECRET_KEY has been changed from default in production."""
        if not self.DEBUG and self.SECRET_KEY == "your-secret-key-change-in-production":
            raise ValueError(
                "SECRET_KEY must be changed from default in production! "
                "Set SECRET_KEY environment variable or update .env file."
            )


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
