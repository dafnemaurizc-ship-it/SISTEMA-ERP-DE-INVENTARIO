from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    brand: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    year: Optional[int] = None
    stock_total: int = Field(1, ge=1)
    description: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    year: Optional[int] = None
    stock_total: Optional[int] = Field(None, ge=0)
    description: Optional[str] = None


class ProductResponse(ProductCreate):
    id: int
    disponibles: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProductsListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ProductResponse]
