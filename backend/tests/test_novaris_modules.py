from datetime import datetime, timezone

from app.models.novaris import Company


def test_dashboard_summary_returns_only_aggregated_kpis(client, db):
    db.add_all([
        Company(name="Acme", ruc="12345678901", email="acme@test.com", phone="999111222", address="Lima", status="active", plan_id=1, created_at=datetime(2025, 1, 10, tzinfo=timezone.utc)),
        Company(name="Beta", ruc="10987654321", email="beta@test.com", phone="999333444", address="Arequipa", status="active", plan_id=2, created_at=datetime(2025, 2, 10, tzinfo=timezone.utc)),
        Company(name="Gamma", ruc="56789012345", email="gamma@test.com", phone="999555666", address="Cusco", status="suspended", plan_id=1, created_at=datetime(2025, 3, 10, tzinfo=timezone.utc)),
    ])
    db.commit()

    response = client.get("/api/v1/erp/dashboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["total_empresas"] == 3
    assert body["empresas_activas"] == 2
    assert body["nuevas_empresas_mes"] >= 0
    assert body["usuarios_totales"] == 0
    assert body["mrr"] >= 0
    assert body["arr"] >= 0
    assert "registros_detallados" not in body


def test_companies_module_returns_independent_records(client, db):
    db.add(Company(name="Acme", ruc="12345678901", email="acme@test.com", phone="999111222", address="Lima", status="active", plan_id=1))
    db.commit()

    response = client.get("/api/v1/erp/companies")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Acme"
