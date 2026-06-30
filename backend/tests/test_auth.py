import pytest
from fastapi.testclient import TestClient


def test_app_has_test_jwt_secret_configured(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "BiblioApp API v1.0"


def test_registro_exitoso(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "nombre": "Juan Pérez",
            "email": "juan@test.com",
            "password": "Segura123!",
        },
    )
    assert response.status_code == 201
    assert response.json()["email"] == "juan@test.com"
    assert response.json()["role"] == "lector"
    assert response.json()["activo"] is True


def test_registro_con_empresa_crea_cliente(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "nombre": "Ana Torres",
            "email": "ana@novaris.test",
            "password": "Segura123!",
            "company_name": "Novaris Labs",
            "ruc": "20600000001",
            "contact_name": "Ana Torres",
            "phone": "999999999",
        },
    )
    assert response.status_code == 201
    assert response.json()["email"] == "ana@novaris.test"
    assert response.json()["role"] == "cliente_admin"


def test_registro_email_duplicado(client: TestClient, usuario_lector):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "nombre": "Otro Usuario",
            "email": "lector@test.com",
            "password": "Segura123!",
        },
    )
    assert response.status_code == 409


def test_login_exitoso(client: TestClient, usuario_lector):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "lector@test.com", "password": "Lector123!"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"
    assert response.json()["role"] == "lector"


def test_login_credenciales_invalidas(client: TestClient, usuario_lector):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "lector@test.com", "password": "WrongPassword"},
    )
    assert response.status_code == 401


def test_endpoint_privado_sin_token(client: TestClient):
    response = client.get("/api/v1/prestamos/mis-prestamos")
    assert response.status_code == 401


def test_products_endpoint_requires_auth(client: TestClient):
    response = client.get("/api/v1/products")
    assert response.status_code == 401
