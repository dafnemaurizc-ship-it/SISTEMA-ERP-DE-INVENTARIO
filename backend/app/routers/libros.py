from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.libro import (
    LibroCreate,
    LibroUpdate,
    LibroResponse,
    LibrosListResponse,
)
from app.services import libro_service
from app.utils.dependencies import require_admin, optional_current_user
from app.models.usuario import Usuario

router = APIRouter()


@router.get("", response_model=LibrosListResponse)
def listar_libros(
    q: str | None = Query(None),
    categoria: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario | None = Depends(optional_current_user),
):
    client_id = current_user.client_id if current_user else None
    total, items = libro_service.buscar_libros(
        db, q, categoria, limit, offset, client_id=client_id
    )

    items_response = []
    for item in items:
        disponibles = libro_service.get_disponibles(db, item.id)
        items_response.append(
            LibroResponse(
                **{**item.__dict__, "disponibles": disponibles}
            )
        )

    return LibrosListResponse(
        total=total, limit=limit, offset=offset, items=items_response
    )


@router.get("/{id}", response_model=LibroResponse)
def obtener_libro(id: int, db: Session = Depends(get_db), current_user: Usuario | None = Depends(optional_current_user)):
    libro = libro_service.obtener_libro(db, id, client_id=current_user.client_id if current_user else None)
    disponibles = libro_service.get_disponibles(db, id)
    return LibroResponse(
        **{**libro.__dict__, "disponibles": disponibles}
    )


@router.post("", response_model=LibroResponse, status_code=201)
def crear_libro(
    request: LibroCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    libro = libro_service.crear_libro(db, request, client_id=current_user.client_id)
    disponibles = libro_service.get_disponibles(db, libro.id)
    return LibroResponse(
        **{**libro.__dict__, "disponibles": disponibles}
    )


@router.put("/{id}", response_model=LibroResponse)
def actualizar_libro(
    id: int,
    request: LibroUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    libro = libro_service.actualizar_libro(db, id, request, client_id=current_user.client_id)
    disponibles = libro_service.get_disponibles(db, id)
    return LibroResponse(
        **{**libro.__dict__, "disponibles": disponibles}
    )


@router.delete("/{id}", status_code=204)
def eliminar_libro(
    id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    libro_service.eliminar_libro(db, id, client_id=current_user.client_id)
