from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.usuario import Usuario
from app.utils.jwt import decode_token
from app.repositories import client_repo
from sqlalchemy.orm import Session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _extract_user_id(payload: dict) -> int | None:
    user_id = payload.get("user_id") or payload.get("sub")
    if user_id is None:
        return None
    if isinstance(user_id, str):
        try:
            return int(user_id)
        except ValueError:
            return None
    return int(user_id)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Usuario | None:
    if not token:
        return None

    payload = decode_token(token)
    user_id = _extract_user_id(payload)

    if not user_id:
        raise HTTPException(status_code=401, detail="Usuario no autorizado")

    user = db.query(Usuario).filter(Usuario.id == user_id).first()

    if not user or not user.activo:
        raise HTTPException(status_code=401, detail="Usuario no autorizado")

    return user


async def optional_current_user(request: Request, db: Session = Depends(get_db)) -> Usuario | None:
    authorization = request.headers.get("authorization")
    if not authorization:
        return None

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]
    try:
        payload = decode_token(token)
    except Exception:
        return None

    user_id = _extract_user_id(payload)
    if not user_id:
        return None

    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or not user.activo:
        return None

    return user


async def require_admin(current_user: Usuario | None = Depends(get_current_user)) -> Usuario:
    if not current_user:
        raise HTTPException(status_code=401, detail="Usuario no autorizado")
    # Allow platform admin and client admin
    if current_user.role not in ("admin", "cliente_admin"):
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return current_user


async def get_current_client(
    current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)
) :
    if not current_user.client_id:
        raise HTTPException(status_code=403, detail="Usuario no está asociado a una empresa")

    client = client_repo.get_client_by_id(db, current_user.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return client
