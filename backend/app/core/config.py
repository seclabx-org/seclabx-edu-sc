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
    ALLOWED_FILE_EXT: str = "pdf,pptx,docx,xlsx,mp4,mp3,png,jpg,jpeg,zip"

    # Signed download
    SIGNED_URL_SECRET: str
    SIGNED_URL_EXPIRES_SECONDS: int = 60

    # Preview
    PREVIEW_DIR: str = "/data/previews"

    # Storage
    STORAGE_BACKEND: str = "local"  # local or oss
    OSS_ENDPOINT: str | None = None
    OSS_BUCKET: str | None = None
    OSS_ACCESS_KEY: str | None = None
    OSS_SECRET: str | None = None
    OSS_BASE_URL: str | None = None  # 可选，自定义访问域名

    # App
    APP_NAME: str = "Ideology Resource Platform"
    ALLOW_ORIGINS: str = "http://localhost:3000"

    # Logging
    LOG_DIR: str = "/data/logs"
    LOG_LEVEL: str = "INFO"
    LOG_RETENTION_DAYS: int = 14

    # AI (AiHubMix OpenAI compatible)
    AIHUBMIX_API_KEY: str | None = None
    AIHUBMIX_BASE_URL: str = "https://aihubmix.com/v1"
    AIHUBMIX_CHAT_MODEL: str = "gemini-3-flash-preview-free"

    # Seed
    SEED_SAMPLE_DATA: bool = True


settings = Settings()
