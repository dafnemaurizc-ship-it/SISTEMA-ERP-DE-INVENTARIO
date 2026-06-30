const NOVARIS_IMPORT_KEY = "novaris:last-import";
const NOVARIS_DB_NAME = "novaris_erp";
const NOVARIS_DB_VERSION = 1;
const NOVARIS_STORE_NAME = "imports";

function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(number) ? number : null;
}

function normalizeColumnName(value) {
    return String(value || "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[-.]/g, "_");
}

function detectDelimiter(headerLine) {
    const candidates = [",", ";", "\t", "|"];
    return candidates
        .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
        .sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseDelimitedLine(line, delimiter) {
    const values = [];
    let current = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && quoted && next === '"') {
            current += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            values.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

function parseDelimitedText(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseDelimitedLine(lines[0], delimiter).map(normalizeColumnName);
    return lines.slice(1).map((line) => {
        const values = parseDelimitedLine(line, delimiter);
        return headers.reduce((row, header, index) => {
            row[header || `columna_${index + 1}`] = values[index] ?? "";
            return row;
        }, {});
    });
}

function firstValue(row, aliases, fragments = []) {
    const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
        acc[normalizeColumnName(key)] = value;
        return acc;
    }, {});

    for (const alias of aliases) {
        const value = normalized[normalizeColumnName(alias)];
        if (value !== undefined && value !== null && value !== "") return value;
    }

    for (const fragment of fragments) {
        const normalizedFragment = normalizeColumnName(fragment);
        const match = Object.entries(normalized).find(([key, value]) =>
            key.includes(normalizedFragment) && value !== undefined && value !== null && value !== ""
        );
        if (match) return match[1];
    }

    return null;
}

function normalizeErpRows(rows) {
    return rows.map((row) => ({
        date: firstValue(row, ["date", "fecha", "periodo", "period", "fecha_movimiento", "fecha_venta"]),
        product: firstValue(row, ["producto", "product", "product_name", "product_detail", "product_type", "nombre", "name", "item", "item_name", "menu_item", "description", "descripcion", "sku", "codigo", "product_id", "isbn"], ["product_detail", "item_name", "menu_item"]),
        quantity: toNumber(firstValue(row, ["ventas", "sales", "sales_volume", "units_sold", "salidas", "egresos", "cantidad", "quantity", "qty", "transaction_qty", "quantity_sold", "qty_sold", "sold_quantity", "order_quantity", "ordered_quantity", "items_sold", "total_quantity", "count", "demanda", "demand_forecast"], ["transaction_qty", "quantity", "qty", "sold", "ventas", "sales", "cantidad"])) || 0,
        incoming: toNumber(firstValue(row, ["entradas", "ingresos", "compras", "incoming", "abastecimiento"])) || 0,
        stock: toNumber(firstValue(row, ["stock", "stock_quantity", "inventario", "inventory", "inventory_level", "stock_total", "stock_actual", "current_stock", "available_stock", "existencias", "disponible", "current_inventory", "inventory_quantity", "on_hand", "onhand"], ["stock", "inventory", "on_hand"])) || 0,
        minimum_stock: toNumber(firstValue(row, ["stock_minimo", "minimum_stock", "minimo", "punto_reorden", "reorder_point", "reorder_level"])) || 0,
        price: toNumber(firstValue(row, ["precio", "price", "precio_unitario", "unit_price", "selling_price", "unit_price_usd", "retail_price", "sales_price", "item_price", "revenue_per_unit"], ["price", "precio"])) || 0,
        cost: toNumber(firstValue(row, ["costo", "cost", "costo_unitario", "unit_cost"])) || 0,
        category: firstValue(row, ["categoria", "category", "rubro", "linea", "familia", "department", "item_category", "product_category", "product_type", "menu_category", "type", "tipo"], ["category", "categoria", "type"]),
    }));
}

function movingAverage(values, windowSize = 3) {
    const slice = values.slice(-windowSize);
    if (!slice.length) return 0;
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function trendFor(values) {
    if (values.length < 2) return "estable";
    const previous = movingAverage(values.slice(0, -1));
    const current = values[values.length - 1];
    const delta = current - previous;
    if (Math.abs(delta) <= Math.max(1, Math.abs(previous) * 0.03)) return "estable";
    return delta > 0 ? "sube" : "baja";
}

function buildColumnPredictions(numeric) {
    return Object.entries(numeric).reduce((acc, [column, stats]) => {
        const values = stats.values || [];
        const predicted = movingAverage(values);
        acc[column] = {
            predicted: Math.round(predicted * 100) / 100,
            trend: trendFor(values),
            classification:
                predicted <= stats.avg * 0.85 ? "bajo" :
                predicted >= stats.avg * 1.15 ? "alto" :
                "normal",
        };
        return acc;
    }, {});
}

function saveImportSnapshot(payload) {
    const rawRows = payload.raw_rows || [];
    const rows = payload.rows || [];
    const storedRawRows = rawRows.slice(0, 200);
    const storedRows = rows.slice(0, 200);
    const computedProfile = buildProfile(rawRows, rows);
    const profile = payload.profile && payload.profile.column_predictions
        ? payload.profile
        : { ...computedProfile, ...(payload.profile || {}), column_predictions: computedProfile.column_predictions };
    const snapshot = {
        saved_at: new Date().toISOString(),
        imported_rows: payload.imported_rows || 0,
        columns: payload.columns || [],
        profile,
        prediction: payload.prediction || null,
        rows: storedRows,
        raw_rows: storedRawRows,
    };
    try {
        localStorage.setItem(NOVARIS_IMPORT_KEY, JSON.stringify(snapshot));
    } catch (error) {
        snapshot.rows = storedRows.slice(0, 50);
        snapshot.raw_rows = storedRawRows.slice(0, 50);
        localStorage.setItem(NOVARIS_IMPORT_KEY, JSON.stringify(snapshot));
    }
    return snapshot;
}

function openImportDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(NOVARIS_DB_NAME, NOVARIS_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(NOVARIS_STORE_NAME)) {
                db.createObjectStore(NOVARIS_STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveFullImportRows(snapshot, payload) {
    if (!window.indexedDB || !snapshot) return;
    const db = await openImportDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(NOVARIS_STORE_NAME, "readwrite");
        tx.objectStore(NOVARIS_STORE_NAME).put({
            id: "last",
            saved_at: snapshot.saved_at,
            columns: payload.columns || [],
            raw_rows: payload.raw_rows || [],
            rows: payload.rows || [],
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function getFullImportRows() {
    if (!window.indexedDB) return null;
    const db = await openImportDb();
    const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(NOVARIS_STORE_NAME, "readonly");
        const request = tx.objectStore(NOVARIS_STORE_NAME).get("last");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
}

function getImportSnapshot() {
    try {
        const value = localStorage.getItem(NOVARIS_IMPORT_KEY);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        return null;
    }
}

function buildProfile(rawRows, normalizedRows) {
    const columns = rawRows.length ? Object.keys(rawRows[0]) : [];
    const numeric = {};
    columns.forEach((column) => {
        const numbers = rawRows.map((row) => toNumber(row[column])).filter((value) => value !== null);
        if (!numbers.length) return;
        const sum = numbers.reduce((total, value) => total + value, 0);
        numeric[column] = {
            count: numbers.length,
            sum: Math.round(sum * 100) / 100,
            avg: Math.round((sum / numbers.length) * 100) / 100,
            min: Math.min(...numbers),
            max: Math.max(...numbers),
            values: numbers,
        };
    });

    const products = new Set(normalizedRows.map((row) => row.product).filter(Boolean));
    const totals = normalizedRows.reduce(
        (acc, row) => {
            const stock = toNumber(row.stock) || 0;
            const outgoing = toNumber(row.quantity) || 0;
            const incoming = toNumber(row.incoming) || 0;
            const minimum = toNumber(row.minimum_stock) || 50;
            acc.stock += stock;
            acc.outgoing += outgoing;
            acc.incoming += incoming;
            if (stock <= Math.max(minimum, 50)) acc.low_stock += 1;
            return acc;
        },
        { rows: rawRows.length, products: products.size || rawRows.length, stock: 0, outgoing: 0, incoming: 0, low_stock: 0 }
    );

    return { columns, numeric, column_predictions: buildColumnPredictions(numeric), totals };
}

function buildLocalPrediction(normalizedRows) {
    const stocks = normalizedRows.map((row) => Number(row.stock || 0));
    const quantities = normalizedRows.map((row) => Number(row.quantity || 0));
    const predictedStock = Math.max(0, Math.round(movingAverage(stocks)));
    const predictedDemand = Math.max(0, Math.round(movingAverage(quantities)));
    const classification = predictedStock <= 50 ? "bajo" : predictedStock <= 120 ? "normal" : "alto";
    return {
        mode: "local_csv_fallback",
        task: "regression_and_classification",
        algorithm: "moving_average_fallback",
        predicted_stock: predictedStock,
        predicted_demand: predictedDemand,
        classification,
        source_rows: normalizedRows.length,
    };
}

function createLocalImportPayload(rawRows) {
    const rows = normalizeErpRows(rawRows);
    const profile = buildProfile(rawRows, rows);
    return {
        imported_rows: rawRows.length,
        columns: rawRows.length ? Object.keys(rawRows[0]) : [],
        profile,
        raw_rows: rawRows,
        rows,
        prediction: buildLocalPrediction(rows),
    };
}

function renderDynamicTable(container, rows, columns, emptyMessage) {
    if (!container) return;
    container.innerHTML = "";

    if (!rows || !rows.length || !columns || !columns.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = emptyMessage;
        container.appendChild(empty);
        return;
    }

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.slice(0, 12).forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
            const td = document.createElement("td");
            td.textContent = row[column] ?? "";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
}
