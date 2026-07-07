from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.models.usuario import Usuario
from app.models.user_login_audit import UserLoginAudit
from app.repositories import usuario_repo
from app.repositories import client_repo
from app.models.client import Client
from app.utils.password import hash_password, verify_password
from app.utils.jwt import create_access_token


def registrar_usuario(
    db: Session,
    nombre: str,
    email: str,
    password: str,
    company_name: str | None = None,
    ruc: str | None = None,
    contact_name: str | None = None,
    phone: str | None = None,
) -> Usuario:
    usuario_existente = usuario_repo.get_usuario_by_email(db, email)
    if usuario_existente:
        raise HTTPException(status_code=409, detail="Email ya está en uso")

    # If company data provided, create a Client and set user as client admin
    client_id = None
    if company_name or ruc:
        # enforce that when providing RUC we have all required company fields
        if ruc:
            digits = ''.join([c for c in str(ruc) if c.isdigit()])
            if len(digits) != 11:
                raise HTTPException(status_code=400, detail="RUC inválido: debe tener exactamente 11 dígitos")
            if not company_name or not phone:
                raise HTTPException(status_code=400, detail="Para registrar una empresa, complete nombre de empresa, RUC y teléfono")
        nuevo_client = client_repo.create_client(
            db,
            Client(
                name=company_name or "",
                ruc=ruc,
                contact_name=contact_name,
                email=email,
                phone=phone,
            ),
        )
        client_id = nuevo_client.id

    password_hash = hash_password(password)
    role = "cliente_admin" if client_id else "lector"
    nuevo_usuario = Usuario(
        nombre=nombre,
        email=email,
        password_hash=password_hash,
        role=role,
        client_id=client_id,
    )

    return usuario_repo.create_usuario(db, nuevo_usuario)


def login_usuario(db: Session, email: str, password: str) -> dict:
    usuario = usuario_repo.get_usuario_by_email(db, email)

    if not usuario or not verify_password(password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    usuario.last_login_at = func.now()
    db.add(UserLoginAudit(usuario_id=usuario.id, email=usuario.email))
    db.commit()
    db.refresh(usuario)

    access_token = create_access_token(
        {"user_id": usuario.id, "email": usuario.email, "role": usuario.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": usuario.role,
        "nombre": usuario.nombre,
        "email": usuario.email,
        "client_id": usuario.client_id,
        "company_name": usuario.company_name,
        "ruc": usuario.ruc,
    }
