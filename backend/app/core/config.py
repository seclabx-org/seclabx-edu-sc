from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # DB
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRES_SECONDS: int = 7200

    # Upload
    UPLOAD_DIR: str = "/data/uploads"
    MAX_UPLOAD_MB: int = 200
    ALLOWED_FILE_EXT: str = "pdf,pptx,docx,xlsx,mp4,png,jpg,zip"

    # Signed download
    SIGNED_URL_SECRET: str
    SIGNED_URL_EXPIRES_SECONDS: int = 60

    # App
    APP_NAME: str = "Ideology Resource Platform"
    ALLOW_ORIGINS: str = "http://localhost:3000"


settings = Settings()
