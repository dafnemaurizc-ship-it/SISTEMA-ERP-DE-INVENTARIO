function formatInteger(value) {
    return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function renderPrediction(snapshot) {
    const container = document.getElementById("dashboard-prediction");
    if (!container) return;

    if (!snapshot || !snapshot.prediction) {
        container.innerHTML = "<strong>Sin prediccion cargada</strong><span>Importa datos para ver demanda, stock estimado y clasificacion.</span>";
        return;
    }

    const prediction = snapshot.prediction;
    container.innerHTML = `
        <strong>${prediction.classification || "sin clasificacion"}</strong>
        <span>Demanda pronosticada: ${formatInteger(prediction.predicted_demand)}</span>
        <span>Stock estimado: ${formatInteger(prediction.predicted_stock)}</span>
        <span>Tarea: ${prediction.task || "automatico"}</span>
        <span>Modelo: ${prediction.algorithm || prediction.mode || "Random Forest / fallback"}</span>
        <span>Actualizado: ${new Date(snapshot.saved_at).toLocaleString("es-PE")}</span>
    `;
}

function renderColumnSummary(snapshot) {
    const container = document.getElementById("dashboard-columns");
    if (!container) return;

    const numeric = snapshot?.profile?.numeric || {};
    const entries = Object.entries(numeric);
    if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No se detectaron columnas numericas.</div>';
        return;
    }

    const rows = entries.map(([column, stats]) => ({
        columna: column,
        registros: stats.count,
        suma: stats.sum,
        promedio: stats.avg,
        minimo: stats.min,
        maximo: stats.max,
    }));
    renderDynamicTable(container, rows, ["columna", "registros", "suma", "promedio", "minimo", "maximo"], "Sin columnas importadas.");
}

function rawValue(row, names) {
    for (const name of names) {
        const value = row?.[name];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
}

function rawNumber(row, names) {
    const value = rawValue(row, names);
    const number = Number(String(value || 0).replace(",", "."));
    return Number.isFinite(number) ? number : 0;
}

function productChartRows(dataset) {
    const rawRows = dataset?.raw_rows || [];
    const rows = dataset?.rows || [];
    const grouped = new Map();
    const total = Math.max(rawRows.length, rows.length);

    Array.from({ length: total }).forEach((_, index) => {
        const raw = rawRows[index] || {};
        const normalized = rows[index] || {};
        const name = String(
            normalized.product ||
            rawValue(raw, ["product_name", "product", "producto", "item_name", "menu_item", "description", "descripcion", "nombre", "name", "sku", "product_id", "codigo"]) ||
            `Producto ${index + 1}`
        );
        const item = grouped.get(name) || { producto: name, stock: 0, ventas: 0, entradas: 0, reorder: 0, count: 0 };
        item.stock = rawNumber(raw, ["stock_quantity", "stock", "inventory_level", "inventory", "inventario", "stock_actual", "current_stock", "available_stock", "existencias", "disponible"]) || Number(normalized.stock || 0) || item.stock;
        item.ventas += rawNumber(raw, ["sales_volume", "units_sold", "demand_forecast", "ventas", "salidas", "egresos", "quantity", "cantidad", "qty", "demanda"]) || Number(normalized.quantity || 0);
        item.entradas += rawNumber(raw, ["incoming", "entradas", "ingresos", "compras", "abastecimiento"]) || Number(normalized.incoming || 0);
        item.reorder = Math.max(item.reorder, rawNumber(raw, ["reorder_level", "reorder_point", "stock_minimo", "minimum_stock", "minimo", "punto_reorden"]) || Number(normalized.minimum_stock || 0));
        item.count += 1;
        grouped.set(name, item);
    });

    return [...grouped.values()].map((item) => ({
        producto: item.producto,
        stock: item.stock,
        ventas: item.count ? item.ventas / item.count : item.ventas,
        entradas: item.count ? item.entradas / item.count : item.entradas,
        reorder: item.reorder || Math.round(item.count ? item.ventas / item.count : item.ventas),
        compra: Math.max(0, Math.round(Math.max(item.reorder, item.count ? item.ventas / item.count : item.ventas) - item.stock)),
    }));
}

function renderAlerts(container, rows) {
    if (!container) return;
    const alerts = rows.map((row) => {
        if (row.stock <= 0) return { ...row, alerta: "Agotado", prioridad: "Urgente", accion: "Reponer hoy o pausar ventas." };
        if (row.stock <= row.reorder) return { ...row, alerta: "Reponer pronto", prioridad: "Urgente", accion: "Comprar mas unidades." };
        if (row.ventas > row.stock) return { ...row, alerta: "Demanda alta", prioridad: "Alta", accion: "Preparar reposicion." };
        return null;
    }).filter(Boolean).slice(0, 8);

    container.innerHTML = "";
    if (!alerts.length) {
        container.className = "empty-state";
        container.textContent = "Sin alertas urgentes.";
        return;
    }

    container.className = "table-wrap";
    const table = document.createElement("table");
    table.innerHTML = `
        <thead><tr><th>Producto</th><th>Stock</th><th>Reposicion</th><th>Demanda</th><th>Alerta</th><th>Que hacer</th></tr></thead>
    `;
    const tbody = document.createElement("tbody");
    alerts.forEach((row) => {
        const badgeClass = row.prioridad === "Urgente" ? "badge badge-danger" : "badge badge-warning";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.producto}</td>
            <td>${formatInteger(row.stock)}</td>
            <td>${formatInteger(row.reorder)}</td>
            <td>${formatInteger(row.ventas)}</td>
            <td><span class="${badgeClass}">${row.alerta}</span></td>
            <td>${row.accion}</td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function renderBarChart(container, rows, valueKey, emptyMessage, sortDirection = "desc") {
    if (!container) return;
    container.innerHTML = "";
    const filtered = rows.filter((row) => Number(row[valueKey]) > 0);
    if (!filtered.length) {
        container.className = "empty-state";
        container.textContent = emptyMessage;
        return;
    }

    container.className = "bar-chart";
    const sorted = filtered
        .sort((a, b) => sortDirection === "asc" ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey])
        .slice(0, 8);
    const max = Math.max(...sorted.map((row) => Number(row[valueKey]) || 0));

    sorted.forEach((row) => {
        const bar = document.createElement("div");
        bar.className = "bar-row";
        bar.innerHTML = `
            <span class="bar-label" title="${row.producto}">${row.producto}</span>
            <span class="bar-track"><span class="bar-fill" style="width: ${Math.max(4, (row[valueKey] / max) * 100)}%"></span></span>
            <span class="bar-value">${formatInteger(row[valueKey])}</span>
        `;
        container.appendChild(bar);
    });
}

function renderComparisonChart(container, rows, emptyMessage) {
    if (!container) return;
    container.innerHTML = "";
    const filtered = rows.filter((row) => Number(row.stock) > 0 || Number(row.ventas) > 0).slice();
    if (!filtered.length) {
        container.className = "empty-state";
        container.textContent = emptyMessage;
        return;
    }

    container.className = "comparison-chart";
    const sorted = filtered.sort((a, b) => b.ventas - a.ventas).slice(0, 8);
    const max = Math.max(...sorted.map((row) => Math.max(Number(row.stock) || 0, Number(row.ventas) || 0)), 1);
    sorted.forEach((row) => {
        const item = document.createElement("div");
        item.className = "comparison-row";
        item.innerHTML = `
            <span class="bar-label" title="${row.producto}">${row.producto}</span>
            <div class="comparison-bars">
                <span class="comparison-line"><b>Stock</b><i style="width:${Math.max(3, (row.stock / max) * 100)}%"></i><em>${formatInteger(row.stock)}</em></span>
                <span class="comparison-line demand"><b>Demanda</b><i style="width:${Math.max(3, (row.ventas / max) * 100)}%"></i><em>${formatInteger(row.ventas)}</em></span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderFlowChart(container, rows, emptyMessage) {
    if (!container) return;
    const totals = rows.reduce(
        (acc, row) => {
            acc.entradas += Number(row.entradas || 0);
            acc.salidas += Number(row.ventas || 0);
            acc.stock += Number(row.stock || 0);
            return acc;
        },
        { entradas: 0, salidas: 0, stock: 0 }
    );
    const data = [
        { producto: "Entradas", valor: totals.entradas },
        { producto: "Salidas / demanda", valor: totals.salidas },
        { producto: "Stock actual", valor: totals.stock },
    ];
    renderBarChart(container, data, "valor", emptyMessage);
}

function renderModelChart(container, snapshot) {
    if (!container) return;
    const prediction = snapshot?.prediction;
    if (!prediction) {
        container.className = "empty-state";
        container.textContent = "Importa datos para ver el modelo.";
        return;
    }
    const data = [
        { producto: "Demanda predicha", valor: Number(prediction.predicted_demand || 0) },
        { producto: "Stock predicho", valor: Number(prediction.predicted_stock || 0) },
        { producto: "Stock promedio", valor: Number(prediction.avg_stock || 0) },
        { producto: "Demanda promedio", valor: Number(prediction.avg_quantity || 0) },
    ];
    renderBarChart(container, data, "valor", "Sin valores predictivos disponibles.");
}

async function dashboardDataset(snapshot) {
    let fullDataset = null;
    try {
        fullDataset = typeof getFullImportRows === "function" ? await getFullImportRows() : null;
    } catch (error) {
        fullDataset = null;
    }
    if (!fullDataset) return snapshot;
    return {
        ...snapshot,
        ...fullDataset,
        prediction: snapshot?.prediction || fullDataset.prediction || null,
        profile: snapshot?.profile || fullDataset.profile || null,
        columns: snapshot?.columns || fullDataset.columns || [],
    };
}

async function loadDashboard() {
    setupAuthUI();

    const snapshot = getImportSnapshot();
    const dataset = await dashboardDataset(snapshot);
    const chartRows = productChartRows(dataset);
    const totals = snapshot?.profile?.totals || {};

    setText("dash-products", formatInteger(totals.products));
    setText("dash-stock", formatInteger(totals.stock));
    setText("dash-low-stock", formatInteger(totals.low_stock));
    setText("dash-demand", formatInteger(snapshot?.prediction?.predicted_demand));

    renderDynamicTable(
        document.getElementById("dashboard-import-table"),
        snapshot?.raw_rows || [],
        snapshot?.columns || [],
        "Importa un CSV o Excel para actualizar este tablero."
    );
    renderPrediction(snapshot);
    renderColumnSummary(snapshot);
    renderBarChart(
        document.getElementById("dashboard-stock-chart"),
        chartRows,
        "stock",
        "Importa datos para ver stock por producto.",
        "asc"
    );
    renderBarChart(
        document.getElementById("dashboard-sales-chart"),
        chartRows,
        "ventas",
        "Importa datos para ver ventas por producto."
    );
    renderComparisonChart(
        document.getElementById("dashboard-demand-stock-chart"),
        chartRows,
        "Importa datos para comparar demanda y stock."
    );
    renderBarChart(
        document.getElementById("dashboard-purchase-chart"),
        chartRows,
        "compra",
        "No hay compras sugeridas con los datos actuales."
    );
    renderFlowChart(
        document.getElementById("dashboard-flow-chart"),
        chartRows,
        "Importa datos para ver entradas y salidas."
    );
    renderModelChart(document.getElementById("dashboard-model-chart"), snapshot);
    renderAlerts(document.getElementById("dashboard-alerts"), chartRows);
}

document.addEventListener("DOMContentLoaded", loadDashboard);
