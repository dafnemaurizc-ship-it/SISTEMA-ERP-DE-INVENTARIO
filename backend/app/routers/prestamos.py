from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.prestamo import (
    PrestamoCreate,
    PrestamoResponse,
    PrestamosListResponse,
)
from app.services import prestamo_service
from app.utils.dependencies import get_current_user, require_admin
from app.models.usuario import Usuario

router = APIRouter()


def build_prestamo_response(prestamo) -> PrestamoResponse:
    vencido = prestamo_service.es_prestamo_vencido(prestamo)
    return PrestamoResponse(
        id=prestamo.id,
        usuario_id=prestamo.usuario_id,
        libro_id=prestamo.libro_id,
        libro=prestamo.libro,
        fecha_prestamo=prestamo.fecha_prestamo,
        fecha_devolucion_esperada=prestamo.fecha_devolucion_esperada,
        fecha_devolucion_real=prestamo.fecha_devolucion_real,
        estado=prestamo.estado,
        vencido=vencido,
    )


@router.post("", response_model=PrestamoResponse, status_code=201)
def solicitar_prestamo(
    request: PrestamoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    prestamo = prestamo_service.solicitar_prestamo(
        db, current_user.id, request.libro_id
    )
    return build_prestamo_response(prestamo)


@router.put("/{id}/devolver", response_model=PrestamoResponse)
def registrar_devolucion(
    id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    prestamo = prestamo_service.registrar_devolucion(
        db, id, current_user.id, current_user.role, client_id=current_user.client_id
    )
    return build_prestamo_response(prestamo)


@router.get("/mis-prestamos", response_model=PrestamosListResponse)
def obtener_mis_prestamos(
    estado: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    total, items = prestamo_service.obtener_prestamos_usuario(
        db, current_user.id, estado, limit, offset, client_id=current_user.client_id
    )

    items_response = []
    for item in items:
        items_response.append(build_prestamo_response(item))

    return PrestamosListResponse(
        total=total, limit=limit, offset=offset, items=items_response
    )


@router.get("", response_model=PrestamosListResponse)
def obtener_prestamos(
    estado: str | None = Query(None),
    usuario_id: int | None = Query(None),
    libro_id: int | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    # require_admin allows both platform admin and cliente_admin; if cliente_admin, limit to their client
    client_id = current_user.client_id
    if current_user.role == 'cliente_admin':
        total, items = prestamo_service.obtener_todos_prestamos(
            db, estado, usuario_id, libro_id, limit, offset, client_id=client_id
        )
    else:
        total, items = prestamo_service.obtener_todos_prestamos(
            db, estado, usuario_id, libro_id, limit, offset
        )

    items_response = []
    for item in items:
        items_response.append(build_prestamo_response(item))

    return PrestamosListResponse(
        total=total, limit=limit, offset=offset, items=items_response
    )
