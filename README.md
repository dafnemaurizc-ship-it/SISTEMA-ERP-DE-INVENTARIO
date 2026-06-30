# � NOVARIS ERP

NOVARIS ERP es una propuesta de plataforma empresarial construida sobre la base de la aplicación previa, adaptada para cubrir procesos de negocio modernos: productos, inventario, compras, ventas, importación, analítica, predicción y reportes.

## Qué incluye

- ✅ Autenticación y separación por cliente o empresa
- ✅ Catálogo de productos y gestión de inventario
- ✅ Módulos de importación y reportes
- ✅ Panel de control operativo con métricas clave
- ✅ Preparado para crecer hacia compras, ventas y analítica avanzada

## Stack tecnológico

**Backend**
- Python 3.11+
- FastAPI
- SQLAlchemy 2.0
- Pydantic
- SQLite

**Frontend**
- HTML5
- CSS3
- JavaScript vanilla

## Instalación rápida

### Requisitos
- Python 3.11+
- pip
- Docker (opcional)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

El backend quedará disponible en http://localhost:8000.

### Frontend

```bash
cd frontend
python -m http.server 3000
```

Luego abre http://localhost:3000.

## Pruebas

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests/ -v
```

## Estructura del proyecto

```text
BIBLIOTECA-VIRTUAL/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── dashboard.html
│   ├── index.html
│   ├── login.html
│   └── js/
└── README.md
```

## Estado del proyecto

La base funcional ya está preparada para mostrar una experiencia ERP inicial, con enfoque en:
- productos y stock
- dashboard ejecutivo
- autenticación multi-tenant
- módulos extensibles para compras, ventas y analítica

## Siguiente paso recomendado

Continuar expandiendo la interfaz con vistas reales de compras, ventas, órdenes y reportes exportables.
