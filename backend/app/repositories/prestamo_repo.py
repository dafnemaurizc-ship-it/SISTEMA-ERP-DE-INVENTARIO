from sqlalchemy.orm import Session
from app.models.prestamo import Prestamo
from datetime import date


def create_prestamo(db: Session, prestamo: Prestamo) -> Prestamo:
    db.add(prestamo)
    db.commit()
    db.refresh(prestamo)
    return prestamo


def get_prestamo_by_id(db: Session, prestamo_id: int) -> Prestamo | None:
    return db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()


def get_prestamo_by_id_client(db: Session, prestamo_id: int, client_id: int) -> Prestamo | None:
    return (
        db.query(Prestamo)
        .filter(Prestamo.id == prestamo_id, Prestamo.client_id == client_id)
        .first()
    )


def get_prestamos_by_usuario(
    db: Session,
    usuario_id: int,
    estado: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Prestamo).filter(Prestamo.usuario_id == usuario_id)

    if estado:
        query = query.filter(Prestamo.estado == estado)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return total, items


def get_prestamos_by_usuario_client(
    db: Session,
    usuario_id: int,
    client_id: int,
    estado: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Prestamo).filter(Prestamo.usuario_id == usuario_id, Prestamo.client_id == client_id)

    if estado:
        query = query.filter(Prestamo.estado == estado)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return total, items


def get_all_prestamos(
    db: Session,
    estado: str | None = None,
    usuario_id: int | None = None,
    libro_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Prestamo)

    if estado:
        query = query.filter(Prestamo.estado == estado)
    if usuario_id:
        query = query.filter(Prestamo.usuario_id == usuario_id)
    if libro_id:
        query = query.filter(Prestamo.libro_id == libro_id)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return total, items


def get_all_prestamos_client(
    db: Session,
    client_id: int,
    estado: str | None = None,
    usuario_id: int | None = None,
    libro_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Prestamo).filter(Prestamo.client_id == client_id)

    if estado:
        query = query.filter(Prestamo.estado == estado)
    if usuario_id:
        query = query.filter(Prestamo.usuario_id == usuario_id)
    if libro_id:
        query = query.filter(Prestamo.libro_id == libro_id)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return total, items


def update_prestamo_devolucion(
    db: Session, prestamo_id: int, fecha_devolucion_real: date
) -> Prestamo | None:
    prestamo = db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()
    if prestamo:
        prestamo.estado = "devuelto"
        prestamo.fecha_devolucion_real = fecha_devolucion_real
        db.commit()
        db.refresh(prestamo)
    return prestamo


def get_prestamos_activos_by_libro(db: Session, libro_id: int) -> int:
    return (
        db.query(Prestamo)
        .filter(Prestamo.libro_id == libro_id, Prestamo.estado == "activo")
        .count()
    )


def get_prestamos_activos_by_libro_client(db: Session, libro_id: int, client_id: int) -> int:
    return (
        db.query(Prestamo)
        .filter(Prestamo.libro_id == libro_id, Prestamo.estado == "activo", Prestamo.client_id == client_id)
        .count()
    )
