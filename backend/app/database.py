from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings


engine_kwargs = {}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from app.models import usuario, libro, prestamo, client, user_login_audit  # noqa: F401
    # Import newly added modules so tables are created
    from app.inventory import models as inventory_models  # noqa: F401
    from app.products import models as products_models  # noqa: F401
    from app.predictions import service as predictions_service  # noqa: F401
    from app.models import novaris  # noqa: F401
    Base.metadata.create_all(bind=engine)
