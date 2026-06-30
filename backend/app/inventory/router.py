from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.inventory.repository import create_movement, get_movements_by_libro_client
from app.inventory.models import InventoryMovement
from app.utils.dependencies import get_current_user, require_admin
from app.models.usuario import Usuario

router = APIRouter()


@router.post("", status_code=201)
def create_inventory_movement(movement: dict, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    inv = InventoryMovement(
        libro_id=movement.get("libro_id"),
        movement_type=movement.get("movement_type"),
        quantity=movement.get("quantity"),
        note=movement.get("note"),
        client_id=current_user.client_id,
    )
    return create_movement(db, inv)


@router.get("/libro/{libro_id}")
def list_movements(libro_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return get_movements_by_libro_client(db, libro_id, client_id=current_user.client_id)
