from typing import List, Union
from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Dopile Linux"
    APP_ENV: str = "production"
    DEBUG: bool = False
    
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    
    DATABASE_URL: str = "sqlite:///./data/dopile.db"
    
    SECRET_KEY: str = "dopile_super_secret_key_change_in_production_min_32_bytes!"
    CSRF_SECRET: str = "dopile_csrf_secret_key_change_in_production_min_32_bytes!"
    
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    CORS_ORIGINS: Union[str, List[str]] = []
    
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_API: str = "100/minute"
    
    HOST_ONLY_LOGIN: bool = False
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    BACKUP_DIR: Path = BASE_DIR / "backups"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.strip():
                return []
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    def is_dev(self) -> bool:
        return self.APP_ENV.lower() in ("dev", "development")


settings = Settings()

# Ensure data and backup directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
