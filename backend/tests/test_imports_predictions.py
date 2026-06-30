from io import BytesIO

from openpyxl import Workbook

from app.utils.jwt import create_access_token


def test_import_csv_and_predict(client, usuario_lector):
    token = create_access_token({"sub": str(usuario_lector.id), "role": usuario_lector.role})
    csv_content = (
        b"fecha,producto,ventas,inventario,entradas,stock_minimo\n"
        b"2024-01-01,Monitor 27,10,100,20,30\n"
        b"2024-01-02,Monitor 27,15,95,5,30\n"
        b"2024-01-03,Monitor 27,20,90,0,30\n"
    )

    response = client.post(
        "/api/v1/imports/inventory/upload-and-predict",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("inventory.csv", BytesIO(csv_content), "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["imported_rows"] == 3
    assert body["columns"] == ["fecha", "producto", "ventas", "inventario", "entradas", "stock_minimo"]
    assert body["rows"][0]["product"] == "Monitor 27"
    assert body["prediction"]["task"] == "regression_and_classification"
    assert body["prediction"]["predicted_stock"] >= 0
    assert body["prediction"]["predicted_demand"] >= 0
    assert body["classification"] in {"bajo", "normal", "alto"}


def test_import_xlsx_and_predict(client, usuario_lector):
    token = create_access_token({"sub": str(usuario_lector.id), "role": usuario_lector.role})

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Inventory"
    sheet.append(["fecha_movimiento", "sku", "salidas", "stock_actual", "precio", "costo"])
    sheet.append(["2024-01-01", "TEC-001", 8, 80, 45.5, 30])
    sheet.append(["2024-01-02", "TEC-001", 12, 76, 45.5, 30])
    sheet.append(["2024-01-03", "TEC-001", 14, 72, 45.5, 30])

    stream = BytesIO()
    workbook.save(stream)
    stream.seek(0)

    response = client.post(
        "/api/v1/imports/inventory/upload-and-predict",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("inventory.xlsx", stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["imported_rows"] == 3
    assert body["rows"][0]["product"] == "TEC-001"
    assert body["prediction"]["task"] == "regression_and_classification"
    assert body["prediction"]["predicted_stock"] >= 0
    assert body["prediction"]["predicted_demand"] >= 0
    assert body["classification"] in {"bajo", "normal", "alto"}


def test_supplier_recommendations_predict_from_imported_rows(client, usuario_lector):
    token = create_access_token({"sub": str(usuario_lector.id), "role": usuario_lector.role})
    rows = [
        {"fecha": "2024-01-01", "producto": "Berry Juice", "categoria": "Bebidas", "ventas": 18, "stock": 0, "stock_minimo": 8},
        {"fecha": "2024-01-02", "producto": "Mango Drink", "categoria": "Bebidas", "ventas": 14, "stock": 4, "stock_minimo": 7},
        {"fecha": "2024-01-03", "producto": "Strawberry Drink", "categoria": "Bebidas", "ventas": 10, "stock": 2, "stock_minimo": 5},
        {"fecha": "2024-01-04", "producto": "Orange Soda", "categoria": "Bebidas", "ventas": 2, "stock": 20, "stock_minimo": 5},
    ]

    response = client.post(
        "/api/v1/predictions/supplier-recommendations",
        headers={"Authorization": f"Bearer {token}"},
        json=rows,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["prediction"]["source"] == "imported_excel"
    assert body["prediction"]["mode"] == "random_forest_excel"
    assert body["rows"]
    assert body["rows"][0]["comprarSugerido"] > 0
    assert body["rows"][0]["algorithm"] == "RandomForestRegressor + RandomForestClassifier"
