from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.novaris import (
    AiLog,
    AiPrediction,
    AuditLog,
    Company,
    Invoice,
    Notification,
    Payment,
    Plan,
    SecurityLog,
    Subscription,
    SupportTicket,
    User,
)

router = APIRouter(prefix="/erp", tags=["ERP"])


def _serialize_item(item: Any) -> dict[str, Any]:
    if hasattr(item, "__dict__"):
        payload = dict(item.__dict__)
        payload.pop("_sa_instance_state", None)
        return payload
    return {"value": item}


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    total_empresas = db.query(func.count(Company.id)).scalar() or 0
    empresas_activas = db.query(func.count(Company.id)).filter(Company.status == "active").scalar() or 0
    nuevas_empresas_mes = (
        db.query(func.count(Company.id))
        .filter(Company.created_at >= datetime.utcnow().replace(day=1))
        .scalar()
        or 0
    )
    usuarios_totales = db.query(func.count(User.id)).scalar() or 0
    suscripciones_activas = db.query(func.count(Subscription.id)).filter(Subscription.status == "active").scalar() or 0
    mrr = db.query(func.coalesce(func.sum(Plan.price), 0)).join(Subscription, Subscription.plan_id == Plan.id).filter(Subscription.status == "active").scalar() or 0
    arr = float(mrr) * 12
    ingresos_mes = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.status == "paid").scalar() or 0
    pagos_pendientes = db.query(func.count(Payment.id)).filter(Payment.status != "paid").scalar() or 0
    tickets_abiertos = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "open").scalar() or 0

    return {
        "total_empresas": total_empresas,
        "empresas_activas": empresas_activas,
        "nuevas_empresas_mes": nuevas_empresas_mes,
        "usuarios_totales": usuarios_totales,
        "suscripciones_activas": suscripciones_activas,
        "mrr": float(mrr),
        "arr": float(arr),
        "ingresos_mes": float(ingresos_mes),
        "pagos_pendientes": pagos_pendientes,
        "tickets_abiertos": tickets_abiertos,
        "disponibilidad_sistema": "99.98%",
    }


@router.get("/companies")
def list_companies(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(Company).order_by(Company.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(func.count(Company.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/users")
def list_users(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(User).order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(func.count(User.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/plans")
def list_plans(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(Plan).order_by(Plan.id).offset(offset).limit(limit).all()
    total = db.query(func.count(Plan.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/subscriptions")
def list_subscriptions(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(Subscription).order_by(Subscription.id).offset(offset).limit(limit).all()
    total = db.query(func.count(Subscription.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/invoices")
def list_invoices(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(Invoice).order_by(Invoice.id).offset(offset).limit(limit).all()
    total = db.query(func.count(Invoice.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/payments")
def list_payments(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(Payment).order_by(Payment.id).offset(offset).limit(limit).all()
    total = db.query(func.count(Payment.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/support-tickets")
def list_support_tickets(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(func.count(SupportTicket.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/reports")
def reports(db: Session = Depends(get_db)):
    return {
        "mrr": db.query(func.coalesce(func.sum(Plan.price), 0)).join(Subscription, Subscription.plan_id == Plan.id).filter(Subscription.status == "active").scalar() or 0,
        "arr": (db.query(func.coalesce(func.sum(Plan.price), 0)).join(Subscription, Subscription.plan_id == Plan.id).filter(Subscription.status == "active").scalar() or 0) * 12,
        "churn": 0,
        "ingresos": db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.status == "paid").scalar() or 0,
        "empresas": db.query(func.count(Company.id)).scalar() or 0,
        "usuarios": db.query(func.count(User.id)).scalar() or 0,
        "pagos": db.query(func.count(Payment.id)).scalar() or 0,
        "tickets": db.query(func.count(SupportTicket.id)).scalar() or 0,
    }


@router.get("/ai")
def list_ai(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    logs = db.query(AiLog).order_by(AiLog.created_at.desc()).offset(offset).limit(limit).all()
    predictions = db.query(AiPrediction).order_by(AiPrediction.created_at.desc()).offset(offset).limit(limit).all()
    return {"logs": [_serialize_item(item) for item in logs], "predictions": [_serialize_item(item) for item in predictions]}


@router.get("/notifications")
def list_notifications(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(Notification).order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(func.count(Notification.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/security")
def list_security(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(SecurityLog).order_by(SecurityLog.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(func.count(SecurityLog.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/audit")
def list_audit(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    items = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(func.count(AuditLog.id)).scalar() or 0
    return {"total": total, "items": [_serialize_item(item) for item in items]}


@router.get("/predictions/customers")
def predict_customer_growth(db: Session = Depends(get_db)):
    """Predict if a customer's revenue will increase using RandomForest when possible.

    Returns list of companies with `will_grow` boolean and `confidence` (0-1).
    Falls back to heuristic when sklearn not available or insufficient training data.
    """
    try:
        from sklearn.ensemble import RandomForestClassifier
    except Exception:
        RandomForestClassifier = None

    now = datetime.utcnow()
    days30 = 30
    from datetime import timedelta
    start_recent = now - timedelta(days=days30)
    start_prev = now - timedelta(days=days30 * 2)

    companies = db.query(Company).all()
    items = []
    X = []
    y = []
    meta = []

    for c in companies:
        # aggregate features
        total_paid = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.company_id == c.id, Invoice.status == 'paid').scalar() or 0
        recent_paid = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.company_id == c.id, Invoice.status == 'paid', Invoice.issued_at >= start_recent).scalar() or 0
        prev_paid = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.company_id == c.id, Invoice.status == 'paid', Invoice.issued_at >= start_prev, Invoice.issued_at < start_recent).scalar() or 0
        subs = db.query(Subscription).filter(Subscription.company_id == c.id).all()
        plan_price = 0
        plan_name = ''
        if subs:
            # take first subscription's plan
            plan = db.query(Plan).filter(Plan.id == subs[0].plan_id).first()
            if plan:
                plan_price = float(plan.price or 0)
                plan_name = plan.name

        users_count = db.query(func.count(User.id)).filter(User.company_id == c.id).scalar() or 0

        features = [float(total_paid or 0), float(recent_paid or 0), float(prev_paid or 0), float(plan_price or 0), float(users_count or 0)]

        # label heuristic: grew if recent_paid > prev_paid
        label = 1 if (recent_paid > prev_paid) else 0

        X.append(features)
        y.append(label)
        meta.append({
            'id': c.id,
            'name': c.name,
            'ruc': c.ruc,
            'plan_name': plan_name,
            'features': features,
        })

    # Prepare response
    response_items = []
    method = 'heuristic'

    try:
        if RandomForestClassifier is not None and len(X) >= 4 and len(set(y)) > 1:
            clf = RandomForestClassifier(n_estimators=100, random_state=42)
            import numpy as np
            X_arr = np.array(X)
            y_arr = np.array(y)
            clf.fit(X_arr, y_arr)
            probs = clf.predict_proba(X_arr)
            preds = clf.predict(X_arr)
            for idx, m in enumerate(meta):
                prob = float(probs[idx][1]) if probs.shape[1] > 1 else float(probs[idx][0])
                response_items.append({
                    'id': m['id'],
                    'name': m['name'],
                    'ruc': m['ruc'],
                    'plan_name': m['plan_name'],
                    'will_grow': bool(int(preds[idx])),
                    'confidence': prob,
                })
            method = 'random_forest'
        else:
            # fallback heuristic
            for m_idx, m in enumerate(meta):
                recent = X[m_idx][1]
                prev = X[m_idx][2]
                confidence = 0.0
                if recent + prev > 0:
                    confidence = float(recent) / float(recent + prev)
                will_grow = recent > prev
                response_items.append({
                    'id': m['id'],
                    'name': m['name'],
                    'ruc': m['ruc'],
                    'plan_name': m['plan_name'],
                    'will_grow': bool(will_grow),
                    'confidence': float(confidence),
                })
            method = 'heuristic'
    except Exception:
        # On any error, return heuristic
        response_items = []
        for m_idx, m in enumerate(meta):
            recent = X[m_idx][1]
            prev = X[m_idx][2]
            confidence = 0.0
            if recent + prev > 0:
                confidence = float(recent) / float(recent + prev)
            will_grow = recent > prev
            response_items.append({
                'id': m['id'],
                'name': m['name'],
                'ruc': m['ruc'],
                'plan_name': m['plan_name'],
                'will_grow': bool(will_grow),
                'confidence': float(confidence),
            })
        method = 'heuristic'

    return {'method': method, 'items': response_items}
