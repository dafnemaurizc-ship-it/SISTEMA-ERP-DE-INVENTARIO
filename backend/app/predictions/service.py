from typing import List, Dict, Any
from statistics import mean
from datetime import datetime

import numpy as np

try:
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
except ModuleNotFoundError:  # pragma: no cover - fallback for minimal environments
    RandomForestClassifier = None
    RandomForestRegressor = None

FIELD_ALIASES = {
    "date": ("date", "fecha", "period", "periodo", "fecha_movimiento", "fecha_venta"),
    "quantity": (
        "quantity",
        "quantity_sold",
        "qty_sold",
        "sold_quantity",
        "order_quantity",
        "ordered_quantity",
        "items_sold",
        "total_quantity",
        "sales",
        "sale",
        "sales_volume",
        "units_sold",
        "demand_forecast",
        "qty",
        "transaction_qty",
        "cantidad",
        "cantidad_vendida",
        "unidades",
        "demanda",
        "ventas",
        "salidas",
        "egresos",
        "count",
    ),
    "stock": (
        "stock",
        "stock_quantity",
        "inventory",
        "inventory_level",
        "inventario",
        "saldo",
        "stock_total",
        "stock_actual",
        "current_stock",
        "available_stock",
        "existencias",
        "disponible",
        "disponibles",
        "current_inventory",
        "inventory_quantity",
        "on_hand",
        "onhand",
    ),
    "category": ("category", "categoria", "rubro", "linea", "familia", "department", "item_category", "product_category", "product_type", "menu_category", "type", "tipo"),
    "product": ("product", "producto", "product_name", "product_detail", "product_type", "name", "nombre", "item", "item_name", "menu_item", "description", "descripcion", "titulo", "sku", "codigo", "product_id", "isbn"),
    "incoming": ("incoming", "entradas", "ingresos", "compras", "abastecimiento"),
    "minimum_stock": ("minimum_stock", "stock_minimo", "minimo", "punto_reorden", "reorder_point", "reorder_level"),
    "price": ("price", "precio", "precio_unitario", "unit_price", "selling_price", "unit_price_usd", "retail_price", "sales_price", "item_price", "revenue_per_unit"),
    "cost": ("cost", "costo", "costo_unitario", "unit_cost"),
}


def normalize_header(value: Any) -> str:
    if value is None:
        return ""
    return (
        str(value)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace(".", "")
    )


FIELD_FRAGMENTS = {
    "quantity": ("transaction_qty", "quantity", "qty", "sold", "ventas", "sales", "cantidad"),
    "stock": ("stock", "inventory", "on_hand"),
    "category": ("category", "categoria", "type"),
    "product": ("product_detail", "item_name", "menu_item", "product"),
}


def _first_value(row: Dict[str, Any], aliases: tuple[str, ...], fragments: tuple[str, ...] = ()) -> Any:
    normalized = {normalize_header(key): value for key, value in row.items()}
    for alias in aliases:
        value = normalized.get(normalize_header(alias))
        if value not in (None, ""):
            return value
    for fragment in fragments:
        normalized_fragment = normalize_header(fragment)
        for key, value in normalized.items():
            if normalized_fragment in key and value not in (None, ""):
                return value
    return None


def _to_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_inventory_row(row: Dict[str, Any]) -> Dict[str, Any]:
    quantity = _to_float(_first_value(row, FIELD_ALIASES["quantity"], FIELD_FRAGMENTS["quantity"]))
    incoming = _to_float(_first_value(row, FIELD_ALIASES["incoming"]))
    stock = _to_float(_first_value(row, FIELD_ALIASES["stock"], FIELD_FRAGMENTS["stock"]))
    minimum_stock = _to_float(_first_value(row, FIELD_ALIASES["minimum_stock"]))
    price = _to_float(_first_value(row, FIELD_ALIASES["price"]))
    cost = _to_float(_first_value(row, FIELD_ALIASES["cost"]))

    return {
        "date": _first_value(row, FIELD_ALIASES["date"]),
        "product": _first_value(row, FIELD_ALIASES["product"], FIELD_FRAGMENTS["product"]),
        "quantity": int(round(quantity)),
        "incoming": int(round(incoming)),
        "stock": int(round(stock)),
        "minimum_stock": int(round(minimum_stock)),
        "price": price,
        "cost": cost,
        "category": _first_value(row, FIELD_ALIASES["category"], FIELD_FRAGMENTS["category"]),
    }


def infer_prediction_task(rows: List[Dict[str, Any]]) -> str:
    has_stock = any(_first_value(row, FIELD_ALIASES["stock"], FIELD_FRAGMENTS["stock"]) not in (None, "") for row in rows)
    has_quantity = any(_first_value(row, FIELD_ALIASES["quantity"], FIELD_FRAGMENTS["quantity"]) not in (None, "") for row in rows)
    if has_stock and has_quantity:
        return "regression_and_classification"
    if has_stock:
        return "classification"
    return "regression"


def simple_moving_average(history: List[float], window: int = 3) -> float:
    if not history:
        return 0.0
    if len(history) < window:
        return mean(history)
    return mean(history[-window:])


def _parse_date(value: Any) -> float:
    if not value:
        return 0.0
    try:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return 0.0
            parsed = datetime.fromisoformat(value)
            return float(parsed.toordinal())
    except Exception:
        return 0.0
    return 0.0


def _threshold_class(stock: float) -> str:
    if stock <= 50:
        return 'bajo'
    if stock <= 120:
        return 'normal'
    return 'alto'


def _build_feature_vector(row: Dict[str, Any]) -> list[float]:
    quantity = float(row.get('quantity', 0) or 0)
    stock = float(row.get('stock', 0) or 0)
    incoming = float(row.get('incoming', 0) or 0)
    minimum_stock = float(row.get('minimum_stock', 0) or 0)
    price = float(row.get('price', 0) or 0)
    cost = float(row.get('cost', 0) or 0)
    fecha = _parse_date(row.get('date') or row.get('fecha') or row.get('period'))
    return [quantity, stock, incoming, minimum_stock, price, cost, fecha]


def predict_demand_from_sales(sales_history: List[dict], periods: int = 1) -> float:
    quantities = [int(s.get('quantity', 0)) for s in sales_history]
    return simple_moving_average(quantities)


def predict_inventory_from_rows(rows: List[dict]) -> dict:
    normalized_rows = [normalize_inventory_row(row) for row in rows]
    task = infer_prediction_task(rows)

    quantities = [float(item['quantity']) for item in normalized_rows]
    stocks = [float(item['stock']) for item in normalized_rows]
    avg_quantity = simple_moving_average(quantities)
    avg_stock = simple_moving_average(stocks) if stocks else 0.0

    features = [_build_feature_vector(item) for item in normalized_rows]
    classes = [_threshold_class(stock) for stock in stocks]

    prediction_mode = 'fallback'
    predicted_stock = int(round(avg_stock))
    predicted_demand = int(round(avg_quantity))
    predicted_class = _threshold_class(predicted_stock)

    if len(features) >= 4 and RandomForestRegressor is not None and RandomForestClassifier is not None:
        try:
            X = np.array(features[:-1])
            y_stock = np.array(stocks[1:])
            y_class = np.array(classes[1:])
            stock_regressor = RandomForestRegressor(n_estimators=50, random_state=42)
            demand_regressor = RandomForestRegressor(n_estimators=50, random_state=42)
            classifier = RandomForestClassifier(n_estimators=50, random_state=42)
            y_quantity = np.array(quantities[1:])
            stock_regressor.fit(X, y_stock)
            demand_regressor.fit(X, y_quantity)
            classifier.fit(X, y_class)
            predicted_stock = int(round(stock_regressor.predict([features[-1]])[0]))
            predicted_demand = int(round(demand_regressor.predict([features[-1]])[0]))
            predicted_class = classifier.predict([features[-1]])[0]
            prediction_mode = 'random_forest'
        except Exception:
            predicted_stock = int(round(avg_stock))
            predicted_class = _threshold_class(predicted_stock)
            prediction_mode = 'fallback'

    return {
        'mode': prediction_mode,
        'task': task,
        'algorithm': 'RandomForestRegressor + RandomForestClassifier' if prediction_mode == 'random_forest' else 'moving_average_fallback',
        'predicted_stock': max(0, predicted_stock),
        'predicted_demand': max(0, predicted_demand),
        'classification': predicted_class,
        'avg_quantity': round(avg_quantity, 2),
        'avg_stock': round(avg_stock, 2),
        'source_rows': len(rows),
        'normalized_preview': normalized_rows[:5],
    }


def _category_codes_from_rows(rows: list[dict]) -> dict[str, int]:
    categories = sorted({str(row.get("category") or "Sin categoria").strip().lower() for row in rows})
    return {category: index + 1 for index, category in enumerate(categories)}


def build_supplier_recommendations_from_rows(rows: List[dict], limit: int = 12) -> dict:
    normalized_rows = [normalize_inventory_row(row) for row in rows]
    normalized_rows = [row for row in normalized_rows if row.get("product")]
    category_codes = _category_codes_from_rows(normalized_rows)
    features = []
    demand_targets = []
    stock_targets = []
    classes = []

    for index, row in enumerate(normalized_rows):
        demand = float(row.get("quantity") or 0)
        stock = float(row.get("stock") or 0)
        minimum_stock = float(row.get("minimum_stock") or 0)
        category = str(row.get("category") or "Sin categoria").strip().lower()
        feature = [
            demand,
            stock,
            float(row.get("incoming") or 0),
            minimum_stock,
            float(row.get("price") or 0),
            float(row.get("cost") or 0),
            float(category_codes.get(category, 0)),
            _parse_date(row.get("date")),
            float(index + 1),
        ]
        features.append(feature)
        demand_targets.append(demand)
        stock_targets.append(stock)
        classes.append(_threshold_class(stock))

    mode = "excel_fallback"
    algorithm = "moving_average_fallback"
    predicted_demands = demand_targets[:]
    predicted_classes = classes[:]

    if len(features) >= 4 and any(value > 0 for value in demand_targets):
        try:
            X = np.array(features[:-1])
            y_demand = np.array(demand_targets[1:])
            y_class = np.array(classes[1:])
            regressor = RandomForestRegressor(n_estimators=80, random_state=42)
            classifier = RandomForestClassifier(n_estimators=80, random_state=42)
            regressor.fit(X, y_demand)
            classifier.fit(X, y_class)
            predicted_demands = [max(0.0, float(value)) for value in regressor.predict(np.array(features))]
            predicted_classes = [str(value) for value in classifier.predict(np.array(features))]
            mode = "random_forest_excel"
            algorithm = "RandomForestRegressor + RandomForestClassifier"
        except Exception:
            predicted_demands = demand_targets[:]
            predicted_classes = classes[:]

    grouped: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(normalized_rows):
        product = str(row.get("product") or f"Producto {index + 1}")
        current = grouped.setdefault(
            product,
            {
                "producto": product,
                "categoria": row.get("category") or "Sin categoria",
                "stock": 0,
                "minimo": 0,
                "ventas": 0,
                "predictedDemand": 0,
                "registros": 0,
                "classification": predicted_classes[index] if predicted_classes else "bajo",
            },
        )
        current["categoria"] = current["categoria"] or row.get("category") or "Sin categoria"
        current["stock"] = int(round(float(row.get("stock") or current["stock"] or 0)))
        current["minimo"] = max(current["minimo"], int(round(float(row.get("minimum_stock") or 0))))
        current["ventas"] += int(round(float(row.get("quantity") or 0)))
        current["predictedDemand"] = max(current["predictedDemand"], int(round(predicted_demands[index])))
        current["registros"] += 1
        current["classification"] = predicted_classes[index] if predicted_classes else current["classification"]

    recommendations = []
    for item in grouped.values():
        average_sales = int(round(item["ventas"] / max(1, item["registros"])))
        demand_reference = max(item["predictedDemand"], average_sales, item["ventas"])
        minimum_stock = item["minimo"] or max(1, int(round(demand_reference * 0.5)))
        missing = max(0, minimum_stock - item["stock"])
        suggested_purchase = max(missing, max(0, demand_reference - item["stock"]))
        if suggested_purchase <= 0 and missing <= 0:
            continue
        recommendations.append(
            {
                **item,
                "minimo": minimum_stock,
                "promedioVentas": average_sales,
                "faltante": missing,
                "predictedDemand": demand_reference,
                "comprarSugerido": suggested_purchase,
                "predictionMode": mode,
                "algorithm": algorithm,
                "recommendation": (
                    "Comprar segun demanda predicha por Random Forest con el Excel importado."
                    if mode == "random_forest_excel"
                    else "Faltan filas utiles para entrenar Random Forest; sugerencia basada en el Excel importado."
                ),
            }
        )

    recommendations.sort(key=lambda item: (item["comprarSugerido"], item["ventas"]), reverse=True)
    selected = recommendations[:limit]
    avg_demand = mean([row["predictedDemand"] for row in selected]) if selected else 0
    return {
        "prediction": {
            "mode": mode,
            "task": "supplier_recommendations",
            "algorithm": algorithm,
            "predicted_demand": int(round(avg_demand)),
            "source": "imported_excel",
            "source_rows": len(rows),
        },
        "rows": selected,
    }
