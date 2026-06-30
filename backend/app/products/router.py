from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.products.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductsListResponse,
)
from app.services import libro_service
from app.utils.dependencies import require_admin, get_current_user
from app.models.usuario import Usuario

router = APIRouter()


@router.get("", response_model=ProductsListResponse)
def listar_products(
    q: str | None = Query(None),
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    total, items = libro_service.buscar_libros(
        db, q, category, limit, offset, client_id=current_user.client_id
    )

    items_response = []
    for item in items:
        disponibles = libro_service.get_disponibles(db, item.id)
        items_response.append(
            ProductResponse(**{**item.__dict__, "disponibles": disponibles})
        )

    return ProductsListResponse(total=total, limit=limit, offset=offset, items=items_response)


@router.get("/{id}", response_model=ProductResponse)
def obtener_product(id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    libro = libro_service.obtener_libro(db, id, client_id=current_user.client_id)
    disponibles = libro_service.get_disponibles(db, id)
    return ProductResponse(**{**libro.__dict__, "disponibles": disponibles})


@router.post("", response_model=ProductResponse, status_code=201)
def crear_product(
    request: ProductCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    libro = libro_service.crear_libro(db, request, client_id=current_user.client_id)
    disponibles = libro_service.get_disponibles(db, libro.id)
    return ProductResponse(**{**libro.__dict__, "disponibles": disponibles})
