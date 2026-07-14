from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration.

    Values can be overridden with environment variables, e.g. set
    ``DATABASE_URL=postgresql+psycopg://user:pass@host/db`` to run against
    Postgres instead of the default local SQLite file.
    """

    database_url: str = "sqlite:///./postdocengine.db"
    cors_origins: str = "*"
    seed_on_startup: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
