from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UsuarioResponse
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=UsuarioResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    usuario = auth_service.registrar_usuario(
        db,
        request.nombre,
        request.email,
        request.password,
        company_name=request.company_name,
        ruc=request.ruc,
        contact_name=request.contact_name,
        phone=request.phone,
    )
    return usuario


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login_usuario(db, request.email, request.password)
