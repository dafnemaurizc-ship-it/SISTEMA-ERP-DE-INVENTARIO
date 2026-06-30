from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Libro(Base):
    __tablename__ = "libros"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False, index=True)
    autor = Column(String(150), nullable=False, index=True)
    isbn = Column(String(20), unique=True, nullable=True)
    categoria = Column(String(80), nullable=False, index=True)
    anio_publicacion = Column(Integer, nullable=True)
    stock_total = Column(Integer, nullable=False, default=1)
    descripcion = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Multi-tenant: cada libro pertenece a un client
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client = relationship("Client")

    prestamos = relationship("Prestamo", back_populates="libro", lazy="dynamic")
