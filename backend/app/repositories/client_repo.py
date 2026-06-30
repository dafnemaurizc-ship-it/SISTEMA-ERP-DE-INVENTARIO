from sqlalchemy.orm import Session
from app.models.client import Client


def create_client(db: Session, client: Client) -> Client:
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def get_client_by_ruc(db: Session, ruc: str) -> Client | None:
    return db.query(Client).filter(Client.ruc == ruc).first()


def get_client_by_id(db: Session, client_id: int) -> Client | None:
    return db.query(Client).filter(Client.id == client_id).first()
