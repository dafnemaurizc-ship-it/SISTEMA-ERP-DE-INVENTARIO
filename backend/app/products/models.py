from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    brand = Column(String(150), nullable=True, index=True)
    sku = Column(String(50), unique=True, nullable=True)
    category = Column(String(80), nullable=True, index=True)
    year = Column(Integer, nullable=True)
    stock_total = Column(Integer, nullable=False, default=1)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client = relationship("Client")
