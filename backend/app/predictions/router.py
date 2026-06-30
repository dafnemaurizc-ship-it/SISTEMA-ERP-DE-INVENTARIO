from fastapi import APIRouter, Depends
from app.predictions.service import (
    build_supplier_recommendations_from_rows,
    predict_demand_from_sales,
    predict_inventory_from_rows,
)
from app.utils.dependencies import get_current_user
from app.models.usuario import Usuario

router = APIRouter()


@router.post('/sales')
def predict_sales(sales_history: list[dict], current_user: Usuario = Depends(get_current_user)):
    prediction = predict_demand_from_sales(sales_history)
    return {'prediction': prediction}


@router.post('/inventory')
def predict_inventory(rows: list[dict], current_user: Usuario = Depends(get_current_user)):
    prediction = predict_inventory_from_rows(rows)
    return {'prediction': prediction}


@router.post('/supplier-recommendations')
def supplier_recommendations(rows: list[dict], current_user: Usuario = Depends(get_current_user)):
    return build_supplier_recommendations_from_rows(rows)
