from sqlalchemy.orm import Session
from app.models.libro import Libro
from app.models.prestamo import Prestamo
from sqlalchemy import func


def create_libro(db: Session, libro: Libro) -> Libro:
    db.add(libro)
    db.commit()
    db.refresh(libro)
    return libro


def get_libro_by_id(db: Session, libro_id: int) -> Libro | None:
    return db.query(Libro).filter(Libro.id == libro_id).first()


def get_libro_by_isbn(db: Session, isbn: str) -> Libro | None:
    return db.query(Libro).filter(Libro.isbn == isbn).first()


def search_libros(
    db: Session,
    q: str | None = None,
    categoria: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Libro)

    if q:
        query = query.filter(
            (Libro.titulo.ilike(f"%{q}%")) | (Libro.autor.ilike(f"%{q}%"))
        )

    if categoria:
        query = query.filter(func.lower(Libro.categoria) == categoria.lower())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return total, items


def get_libro_by_id_client(db: Session, libro_id: int, client_id: int) -> Libro | None:
    return db.query(Libro).filter(Libro.id == libro_id, Libro.client_id == client_id).first()


def get_libro_by_isbn_client(db: Session, isbn: str, client_id: int) -> Libro | None:
    return db.query(Libro).filter(Libro.isbn == isbn, Libro.client_id == client_id).first()


def search_libros_client(
    db: Session,
    client_id: int,
    q: str | None = None,
    categoria: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Libro).filter(Libro.client_id == client_id)

    if q:
        query = query.filter(
            (Libro.titulo.ilike(f"%{q}%")) | (Libro.autor.ilike(f"%{q}%"))
        )

    if categoria:
        query = query.filter(func.lower(Libro.categoria) == categoria.lower())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return total, items


def update_libro(db: Session, libro_id: int, data: dict) -> Libro | None:
    libro = db.query(Libro).filter(Libro.id == libro_id).first()
    if libro:
        for key, value in data.items():
            setattr(libro, key, value)
        db.commit()
        db.refresh(libro)
    return libro


def delete_libro(db: Session, libro_id: int) -> bool:
    libro = db.query(Libro).filter(Libro.id == libro_id).first()
    if libro:
        db.delete(libro)
        db.commit()
        return True
    return False


def get_disponibles(db: Session, libro_id: int) -> int:
    libro = db.query(Libro).filter(Libro.id == libro_id).first()
    if not libro:
        return 0

    prestados = (
        db.query(func.count(Prestamo.id))
        .filter(Prestamo.libro_id == libro_id, Prestamo.estado == "activo")
        .scalar()
    )
    return libro.stock_total - (prestados or 0)
