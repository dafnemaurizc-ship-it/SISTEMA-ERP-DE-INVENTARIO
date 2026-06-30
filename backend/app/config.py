import json

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = "sqlite:///./biblioapp.db"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24
    debug: bool = False
    allowed_origins_value: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5500,http://localhost:5500",
        validation_alias="ALLOWED_ORIGINS"
    )

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "production", "prod"}:
                return False
            if normalized in {"debug", "development", "dev"}:
                return True
        return value

    @property
    def allowed_origins(self) -> list[str]:
        value = self.allowed_origins_value.strip()
        if value.startswith("["):
            parsed = json.loads(value)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in value.split(",") if origin.strip()]


settings = Settings()
