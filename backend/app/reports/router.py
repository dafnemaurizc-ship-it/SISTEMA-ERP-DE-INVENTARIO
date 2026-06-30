from fastapi import APIRouter, Depends
from app.utils.dependencies import get_current_user
from app.models.usuario import Usuario

router = APIRouter()


@router.get('/inventory')
def report_inventory(current_user: Usuario = Depends(get_current_user)):
    # placeholder: return summary counts
    return {'client_id': current_user.client_id, 'total_products': 0, 'low_stock': []}
