from pydantic import BaseModel, Field
from datetime import datetime


class RegisterRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    email: str
    password: str = Field(..., min_length=8)
    # Optional company (client) fields for multi-tenant registration
    company_name: str | None = Field(None, min_length=2, max_length=200)
    ruc: str | None = Field(None, min_length=11, max_length=11, pattern=r"^\d{11}$")
    contact_name: str | None = None
    phone: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    email: str
    role: str
    activo: bool
    created_at: datetime
    client_id: int | None = None
    company_name: str | None = None
    ruc: str | None = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    nombre: str
    email: str
    client_id: int | None = None
    company_name: str | None = None
    ruc: str | None = None
