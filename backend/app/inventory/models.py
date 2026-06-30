from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    # vinculado al libro/producto existente
    libro_id = Column(Integer, ForeignKey("libros.id"), nullable=False)
    movement_type = Column(String(30), nullable=False)  # entrada/salida/ajuste/venta
    quantity = Column(Float, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    libro = relationship("Libro")
