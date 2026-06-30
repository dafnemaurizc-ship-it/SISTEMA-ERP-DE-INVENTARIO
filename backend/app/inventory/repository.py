from sqlalchemy.orm import Session
from app.inventory.models import InventoryMovement


def create_movement(db: Session, movement: InventoryMovement) -> InventoryMovement:
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def get_movements_by_libro_client(
    db: Session, libro_id: int, client_id: int | None = None, limit: int = 100
):
    query = db.query(InventoryMovement).filter(InventoryMovement.libro_id == libro_id)
    if client_id:
        query = query.filter(InventoryMovement.client_id == client_id)
    return query.order_by(InventoryMovement.created_at.desc()).limit(limit).all()
