from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.models.prestamo import Prestamo
from app.repositories import prestamo_repo, libro_repo


def solicitar_prestamo(db: Session, usuario_id: int, libro_id: int) -> Prestamo:
    disponibles = libro_repo.get_disponibles(db, libro_id)
    if disponibles <= 0:
        raise HTTPException(
            status_code=409, detail="No hay ejemplares disponibles para este libro"
        )

    today = date.today()
    fecha_devolucion = today + timedelta(days=14)

    nuevo_prestamo = Prestamo(
        usuario_id=usuario_id,
        libro_id=libro_id,
        fecha_prestamo=today,
        fecha_devolucion_esperada=fecha_devolucion,
        estado="activo",
    )

    return prestamo_repo.create_prestamo(db, nuevo_prestamo)


def registrar_devolucion(
    db: Session, prestamo_id: int, usuario_id: int, usuario_role: str, client_id: int | None = None
) -> Prestamo:
    prestamo = (
        prestamo_repo.get_prestamo_by_id(db, prestamo_id)
        if client_id is None
        else prestamo_repo.get_prestamo_by_id_client(db, prestamo_id, client_id)
    )
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if prestamo.estado != "activo":
        raise HTTPException(status_code=409, detail="El préstamo ya fue devuelto")

    if prestamo.usuario_id != usuario_id and usuario_role != "admin":
        raise HTTPException(
            status_code=403, detail="No puedes devolver el préstamo de otro usuario"
        )

    return prestamo_repo.update_prestamo_devolucion(db, prestamo_id, date.today())


def obtener_prestamos_usuario(
    db: Session, usuario_id: int, estado: str | None = None, limit: int = 20, offset: int = 0, client_id: int | None = None
):
    if client_id:
        return prestamo_repo.get_prestamos_by_usuario_client(db, usuario_id, client_id, estado, limit, offset)
    return prestamo_repo.get_prestamos_by_usuario(db, usuario_id, estado, limit, offset)


def obtener_todos_prestamos(
    db: Session,
    estado: str | None = None,
    usuario_id: int | None = None,
    libro_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
    client_id: int | None = None,
):
    if client_id:
        return prestamo_repo.get_all_prestamos_client(db, client_id, estado, usuario_id, libro_id, limit, offset)
    return prestamo_repo.get_all_prestamos(db, estado, usuario_id, libro_id, limit, offset)


def es_prestamo_vencido(prestamo: Prestamo) -> bool:
    if prestamo.estado != "activo":
        return False
    return prestamo.fecha_devolucion_esperada < date.today()
