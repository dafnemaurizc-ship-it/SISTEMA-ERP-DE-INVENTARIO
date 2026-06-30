function reportNumber(value) {
    return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function setReportText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function predictionRows(snapshot) {
    return Object.entries(snapshot?.profile?.column_predictions || {}).map(([column, prediction]) => ({
        columna: column,
        valor_estimado: prediction.predicted,
        tendencia: prediction.trend,
        nivel: prediction.classification,
        que_hacer: actionForColumn(column, prediction),
        promedio: snapshot.profile.numeric[column]?.avg,
        minimo: snapshot.profile.numeric[column]?.min,
        maximo: snapshot.profile.numeric[column]?.max,
    }));
}

function actionForColumn(column, prediction) {
    const name = column.toLowerCase();
    const trend = prediction.trend;
    const level = prediction.classification;

    if (name.includes("stock") || name.includes("inventory")) {
        if (trend === "baja" || level === "bajo") return "Comprar o reponer antes de quedarte sin producto.";
        if (level === "alto") return "No compres mas por ahora; revisa si ese stock se esta vendiendo.";
        return "Mantener seguimiento normal del inventario.";
    }

    if (name.includes("sales") || name.includes("sold") || name.includes("venta") || name.includes("demand")) {
        if (trend === "sube" || level === "alto") return "Preparar mas stock porque la demanda esta creciendo.";
        if (trend === "baja" || level === "bajo") return "Revisar precio, promociones o si el producto perdio interes.";
        return "Mantener oferta actual y seguir observando ventas.";
    }

    if (name.includes("price") || name.includes("precio")) {
        if (trend === "sube") return "Verifica que el precio no este alejando clientes.";
        if (trend === "baja") return "Cuida el margen; vender mas barato no siempre deja ganancia.";
        return "Precio estable; compara con la competencia.";
    }

    if (name.includes("discount") || name.includes("promo")) {
        if (level === "alto") return "Hay muchas promociones; revisa si aun ganas dinero.";
        return "Promociones controladas; mide si ayudan a vender mas.";
    }

    if (name.includes("reorder")) {
        return "Usa este dato para decidir cuando volver a comprar mercaderia.";
    }

    return "Revisar este indicador junto con ventas y stock antes de decidir.";
}

function summaryRows(snapshot) {
    return Object.entries(snapshot?.profile?.numeric || {}).map(([column, stats]) => ({
        columna: column,
        registros: stats.count,
        suma: stats.sum,
        promedio: stats.avg,
        minimo: stats.min,
        maximo: stats.max,
    }));
}

function valueFrom(row, names) {
    for (const name of names) {
        const value = row?.[name];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
}

function numberFrom(row, names) {
    const value = valueFrom(row, names);
    if (value === null) return 0;
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : 0;
}

function productName(raw, normalized, index) {
    return (
        normalized?.product ||
        valueFrom(raw, ["product_name", "product", "producto", "item_name", "menu_item", "description", "descripcion", "sku", "product_id", "codigo"]) ||
        `Producto ${index + 1}`
    );
}

function productRecommendations(dataset) {
    const rawRows = dataset?.raw_rows || [];
    const normalizedRows = dataset?.rows || [];
    const grouped = new Map();

    rawRows.forEach((raw, index) => {
        const normalized = normalizedRows[index] || {};
        const name = String(productName(raw, normalized, index));
        const current = grouped.get(name) || {
            producto: name,
            categoria: normalized.category || valueFrom(raw, ["category", "categoria", "department", "linea", "region"]) || "Sin categoria",
            stock_actual: 0,
            punto_reposicion: 0,
            ventas_estimadas: 0,
            registros: 0,
        };

        const stock = normalized.stock || numberFrom(raw, ["stock_quantity", "stock", "inventory_level", "inventory", "inventario"]);
        const reorder = normalized.minimum_stock || numberFrom(raw, ["reorder_level", "reorder_point", "stock_minimo", "minimum_stock"]);
        const sales = normalized.quantity || numberFrom(raw, ["sales_volume", "units_sold", "demand_forecast", "ventas", "salidas", "quantity"]);

        current.stock_actual = stock || current.stock_actual;
        current.punto_reposicion = Math.max(current.punto_reposicion, reorder || 0);
        current.ventas_estimadas += sales || 0;
        current.registros += 1;
        grouped.set(name, current);
    });

    return [...grouped.values()].map((item) => {
        const avgSales = item.registros ? item.ventas_estimadas / item.registros : 0;
        const reorderPoint = item.punto_reposicion || Math.max(1, Math.round(avgSales));
        let alerta = "Stock suficiente";
        let accion = "Mantener seguimiento normal.";
        let prioridad = "Normal";

        if (item.stock_actual <= 0) {
            alerta = "Agotado";
            accion = "Reponer hoy o pausar ventas hasta tener stock.";
            prioridad = "Urgente";
        } else if (item.stock_actual <= reorderPoint) {
            alerta = "Reponer pronto";
            accion = "Comprar mas unidades antes de quedarte sin producto.";
            prioridad = "Urgente";
        } else if (avgSales > item.stock_actual) {
            alerta = "Demanda alta";
            accion = "Preparar reposicion porque se vende mas rapido que tu stock.";
            prioridad = "Alta";
        } else if (item.stock_actual > reorderPoint * 3 && avgSales < item.stock_actual * 0.15) {
            alerta = "Mucho stock";
            accion = "Evita comprar mas; considera promocion para mover inventario.";
            prioridad = "Media";
        }

        return {
            producto: item.producto,
            categoria: item.categoria,
            stock_actual: Math.round(item.stock_actual * 100) / 100,
            punto_reposicion: reorderPoint,
            demanda_estimada: Math.round(avgSales * 100) / 100,
            alerta,
            prioridad,
            que_hacer: accion,
        };
    }).sort((a, b) => {
        const priority = { "Urgente": 0, "Alta": 1, "Media": 2, "Normal": 3 };
        return priority[a.prioridad] - priority[b.prioridad] || a.stock_actual - b.stock_actual;
    });
}

function renderProductAlerts(container, rows) {
    if (!container) return;
    container.innerHTML = "";
    if (!rows.length) {
        container.className = "empty-state";
        container.textContent = "Sin productos detectados.";
        return;
    }

    container.className = "table-wrap";
    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Stock actual</th>
                <th>Punto reposicion</th>
                <th>Demanda estimada</th>
                <th>Alerta</th>
                <th>Prioridad</th>
                <th>Que hacer</th>
            </tr>
        </thead>
    `;
    const tbody = document.createElement("tbody");
    rows.slice(0, 30).forEach((row) => {
        const tr = document.createElement("tr");
        const badgeClass = row.prioridad === "Urgente" ? "badge badge-danger" : row.prioridad === "Alta" ? "badge badge-warning" : row.prioridad === "Media" ? "badge badge-info" : "badge badge-success";
        tr.innerHTML = `
            <td>${row.producto}</td>
            <td>${row.categoria}</td>
            <td>${row.stock_actual}</td>
            <td>${row.punto_reposicion}</td>
            <td>${row.demanda_estimada}</td>
            <td><span class="${badgeClass}">${row.alerta}</span></td>
            <td><span class="${badgeClass}">${row.prioridad}</span></td>
            <td>${row.que_hacer}</td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function renderMethod(snapshot) {
    const container = document.getElementById("report-method");
    if (!container) return;
    if (!snapshot?.prediction) {
        container.innerHTML = "<strong>Sin datos cargados</strong><span>Importa un CSV en Prediccion para generar el reporte.</span>";
        return;
    }

    container.innerHTML = `
        <strong>${snapshot.prediction.algorithm || "moving_average_fallback"}</strong>
        <span>Se usan dos enfoques juntos: regresion para estimar numeros y clasificacion para convertir esos numeros en alertas faciles de entender.</span>
        <span>Regresion: estima demanda o movimiento esperado del producto.</span>
        <span>Clasificacion: convierte el resultado en Agotado, Reponer pronto, Demanda alta, Mucho stock o Stock suficiente.</span>
        <span>La parte mas importante esta en "Productos que requieren accion": ahi se muestra de que producto se habla.</span>
        <span>Stock actual indica cuantas unidades tienes. Punto de reposicion indica desde que nivel conviene comprar mas.</span>
        <span>Ventas estimadas muestra cuanto se mueve el producto segun la base cargada.</span>
        <span>Estado resume el riesgo: agotado, reponer pronto, demanda alta o stock suficiente.</span>
    `;
}

function renderRecommendations(snapshot) {
    const container = document.getElementById("report-recommendations");
    if (!container) return;

    const rows = predictionRows(snapshot);
    if (!rows.length) {
        container.textContent = "Sin recomendaciones.";
        return;
    }

    const high = rows.filter((row) => row.nivel === "alto").map((row) => row.columna);
    const low = rows.filter((row) => row.nivel === "bajo").map((row) => row.columna);
    const rising = rows.filter((row) => row.tendencia === "sube").map((row) => row.columna);
    const falling = rows.filter((row) => row.tendencia === "baja").map((row) => row.columna);

    container.innerHTML = `
        <strong>Acciones sugeridas</strong>
        <span>Nivel alto: ${high.join(", ") || "ninguno"}.</span>
        <span>Nivel bajo: ${low.join(", ") || "ninguno"}.</span>
        <span>Campos en crecimiento: ${rising.join(", ") || "ninguno"}.</span>
        <span>Campos en caida: ${falling.join(", ") || "ninguno"}.</span>
    `;
}

async function loadReports() {
    setupAuthUI();

    const snapshot = getImportSnapshot();
    const fullDataset = await getFullImportRows();
    const dataset = fullDataset || snapshot;
    const numericCount = Object.keys(snapshot?.profile?.numeric || {}).length;

    setReportText("report-rows", reportNumber(snapshot?.imported_rows));
    setReportText("report-numeric", reportNumber(numericCount));
    setReportText("report-stock", reportNumber(snapshot?.prediction?.predicted_stock));
    setReportText("report-demand", reportNumber(snapshot?.prediction?.predicted_demand));

    const explanation = document.getElementById("report-explanation");
    if (explanation && snapshot?.prediction) {
        explanation.textContent = `Este reporte usa ${snapshot.imported_rows} filas de la ultima base importada. Primero identifica productos y stock; luego marca cuales estan agotados, cuales necesitan reposicion y cuales tienen demanda alta.`;
    }

    renderMethod(snapshot);
    renderRecommendations(snapshot);
    renderProductAlerts(
        document.getElementById("report-product-actions"),
        productRecommendations(dataset)
    );
    renderDynamicTable(
        document.getElementById("report-column-predictions"),
        predictionRows(snapshot),
        ["columna", "valor_estimado", "tendencia", "nivel", "que_hacer", "promedio", "minimo", "maximo"],
        "Sin predicciones por columna."
    );
    renderDynamicTable(
        document.getElementById("report-column-summary"),
        summaryRows(snapshot),
        ["columna", "registros", "suma", "promedio", "minimo", "maximo"],
        "Sin resumen estadistico."
    );
}

document.addEventListener("DOMContentLoaded", loadReports);
