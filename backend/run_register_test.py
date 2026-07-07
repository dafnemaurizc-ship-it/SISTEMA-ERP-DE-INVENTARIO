import os
# Use in-memory SQLite for testing to avoid external DB driver requirements
os.environ['DATABASE_URL'] = 'sqlite:///./test_register.db'
from fastapi.testclient import TestClient
from app.main import app
from app.database import create_tables
create_tables()
client = TestClient(app)

invalid = {
    "nombre": "Prueba Admin",
    "email": "prueba-invalid@example.com",
    "password": "contrasena123",
    "company_name": "Empresa Prueba",
    "ruc": "123",
    "phone": "+51900000000"
}
print('=== Enviando payload inválido (RUC corto) ===')
res = client.post('/api/v1/auth/register', json=invalid)
print(res.status_code)
try:
    print(res.json())
except Exception as e:
    print('No JSON:', e)

valid = {
    "nombre": "Prueba Admin 2",
    "email": "prueba-valid@example.com",
    "password": "contrasena123",
    "company_name": "Empresa Valida S.A.",
    "ruc": "20666600000",
    "phone": "+51911111111"
}
print('\n=== Enviando payload válido ===')
res2 = client.post('/api/v1/auth/register', json=valid)
print(res2.status_code)
try:
    print(res2.json())
except Exception as e:
    print('No JSON:', e)
