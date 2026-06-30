from sqlalchemy import Column, Integer, Date, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Prestamo(Base):
    __tablename__ = "prestamos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    libro_id = Column(Integer, ForeignKey("libros.id"), nullable=False)
    fecha_prestamo = Column(Date, nullable=False)
    fecha_devolucion_esperada = Column(Date, nullable=False)
    fecha_devolucion_real = Column(Date, nullable=True)
    estado = Column(String(15), nullable=False, default="activo")

    # Multi-tenant: movimiento asociado a client (derivado de usuario/libro)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    usuario = relationship("Usuario", back_populates="prestamos")
    libro = relationship("Libro", back_populates="prestamos")
