function commerceFormatNumber(value) {
    return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function commerceFormatMoney(value) {
    return `$${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
}

function commerceMedian(values) {
    const numbers = values.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (!numbers.length) return 0;
    const middle = Math.floor(numbers.length / 2);
    return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

function commerceNormalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function commerceSetText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function commerceNormalizeColumnName(value) {
    if (typeof normalizeColumnName === "function") return normalizeColumnName(value);
    return String(value || "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[-.]/g, "_");
}

function commerceFirstValue(row, aliases, fragments = []) {
    const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
        acc[commerceNormalizeColumnName(key)] = value;
        return acc;
    }, {});

    for (const alias of aliases) {
        const value = normalized[commerceNormalizeColumnName(alias)];
        if (value !== undefined && value !== null && value !== "") return value;
    }

    for (const fragment of fragments) {
        const normalizedFragment = commerceNormalizeColumnName(fragment);
        const match = Object.entries(normalized).find(([key, value]) =>
            key.includes(normalizedFragment) && value !== undefined && value !== null && value !== ""
        );
        if (match) return match[1];
    }

    return null;
}

function commerceNumber(row, aliases, fragments = []) {
    const value = commerceFirstValue(row, aliases, fragments);
    if (value === null) return null;
    let clean = String(value).trim().replace(/[^\d,.-]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
        clean = clean.replace(/,/g, "");
    } else {
        clean = clean.replace(",", ".");
    }
    const number = Number(clean);
    return Number.isFinite(number) ? number : null;
}

function commerceUnitCostFromRow(raw, normalized = {}) {
    const costValue = commerceNumber(raw, ["costo", "cost", "costo_unitario", "unit_cost", "purchase_cost", "supplier_cost", "wholesale_cost"], ["cost", "costo"]);
    if (costValue !== null && costValue > 0) return costValue;

    const normalizedCost = Number(normalized.cost);
    if (Number.isFinite(normalizedCost) && normalizedCost > 0) return normalizedCost;

    const priceValue = commerceNumber(raw, ["precio", "price", "precio_unitario", "unit_price", "selling_price", "unit_price_usd", "retail_price", "sales_price", "item_price", "purchase_price", "supplier_price", "wholesale_price", "revenue_per_unit"], ["price", "precio"]);
    if (priceValue !== null && priceValue > 0) return priceValue;

    const normalizedPrice = Number(normalized.price);
    if (Number.isFinite(normalizedPrice) && normalizedPrice > 0) return normalizedPrice;

    const revenueValue = commerceNumber(raw, ["revenue", "total_revenue", "sales_amount", "total_sales", "venta_total", "ventas_total", "importe", "monto", "subtotal", "gross_sales", "net_sales", "ingresos", "income"], ["revenue", "amount", "importe", "monto", "ingres"]);
    const quantityValue = commerceNumber(raw, ["sales_volume", "units_sold", "ventas", "salidas", "egresos", "cantidad", "quantity", "qty", "transaction_qty", "quantity_sold", "qty_sold", "sold_quantity", "order_quantity", "ordered_quantity", "items_sold", "total_quantity", "count", "demanda"], ["transaction_qty", "quantity", "qty", "sold", "ventas", "sales", "cantidad"]);
    if (revenueValue !== null && revenueValue > 0 && quantityValue !== null && quantityValue > 0) {
        return revenueValue / quantityValue;
    }

    return 0;
}

function commerceInferCategory(product, category) {
    const current = String(category || "").trim();
    if (current && current !== "Sin categoria") return current;

    const text = commerceNormalizeText(product);
    if (/(cola|soda|juice|jugo|drink|bebida|agua|tea|cafe|cranberry|orange|mango|berry)/.test(text)) return "Bebidas";
    if (/(snack|galleta|pan|postre|dulce|cream|helado)/.test(text)) return "Snacks";
    if (/(comida|menu|plato|food|meal|pollo|carne|pizza|burger)/.test(text)) return "Comidas";
    if (/(ropa|shirt|camisa|polo|zapato|shoe|textil)/.test(text)) return "Textil";
    if (/(accesorio|mouse|teclado|cable|funda)/.test(text)) return "Accesorios";
    if (/(monitor|periferico|electron|computo|ssd|disco|laptop|tablet|telefono|phone|celular)/.test(text)) return "Tecnologia";
    return current || "General";
}

function commerceEstimatedSalePrice(row) {
    const directPrice = Number(row.precio || 0);
    if (Number.isFinite(directPrice) && directPrice > 0) {
        return { price: directPrice, mode: "Precio importado" };
    }

    const ventas = Number(row.ventas || 0);
    const importedRevenue = Number(row.ingresoEstimado || 0);
    if (ventas > 0 && importedRevenue > 0) {
        return { price: importedRevenue / ventas, mode: "Ingresos importados" };
    }

    const unitCost = Number(row.costo || row.costoUnitario || 0);
    if (Number.isFinite(unitCost) && unitCost > 0) {
        return { price: unitCost * 1.35, mode: "Costo + margen" };
    }

    const text = commerceNormalizeText(`${row.producto} ${row.categoria}`);
    if (/(cola|soda|juice|jugo|drink|bebida|agua|tea|cafe|cranberry|orange|mango|berry)/.test(text)) {
        return { price: 4.5, mode: "Estimacion ERP" };
    }
    if (/(snack|galleta|pan|postre|dulce|cream|helado)/.test(text)) {
        return { price: 6.5, mode: "Estimacion ERP" };
    }
    if (/(comida|menu|plato|food|meal|pollo|carne|pizza|burger)/.test(text)) {
        return { price: 18, mode: "Estimacion ERP" };
    }
    if (/(ropa|shirt|camisa|polo|zapato|shoe|textil)/.test(text)) {
        return { price: 49, mode: "Estimacion ERP" };
    }
    if (/(accesorio|mouse|teclado|cable|funda)/.test(text)) {
        return { price: 35, mode: "Estimacion ERP" };
    }
    if (/(monitor|periferico|electron|computo|ssd|disco)/.test(text)) {
        return { price: 220, mode: "Estimacion ERP" };
    }
    if (/(laptop|notebook|tablet|telefono|phone|celular)/.test(text)) {
        return { price: 1200, mode: "Estimacion ERP" };
    }

    return { price: 10, mode: "Estimacion ERP" };
}

function commerceProductRows(dataset) {
    const rawRows = dataset?.raw_rows || [];
    const normalizedRows = rawRows.length && typeof normalizeErpRows === "function"
        ? normalizeErpRows(rawRows)
        : dataset?.rows?.length
            ? dataset.rows
            : [];
    const grouped = new Map();

    normalizedRows.forEach((row, index) => {
        const raw = rawRows[index] || {};
        const name = String(
            row.product ||
            commerceFirstValue(raw, ["product_name", "product", "producto", "product_detail", "product_type", "item_name", "menu_item", "description", "descripcion", "nombre", "name", "sku", "codigo", "product_id", "item"], ["product_detail", "item_name", "menu_item"]) ||
            `Producto ${index + 1}`
        );
        const category = commerceInferCategory(
            name,
            row.category || commerceFirstValue(raw, ["categoria", "category", "rubro", "linea", "familia", "department", "item_category", "product_category", "product_type", "menu_category", "type", "tipo"], ["category", "categoria", "type"]) || "Sin categoria"
        );
        const stockValue = commerceNumber(raw, ["stock_quantity", "stock", "inventory_level", "inventory", "inventario", "stock_total", "stock_actual", "current_stock", "available_stock", "existencias", "disponible", "current_inventory", "inventory_quantity", "on_hand", "onhand"], ["stock", "inventory", "on_hand"]);
        const minimumValue = commerceNumber(raw, ["reorder_level", "reorder_point", "stock_minimo", "minimum_stock", "minimo", "punto_reorden"]);
        const salesValue = commerceNumber(raw, ["sales_volume", "units_sold", "demand_forecast", "ventas", "salidas", "egresos", "cantidad", "quantity", "qty", "transaction_qty", "quantity_sold", "qty_sold", "sold_quantity", "order_quantity", "ordered_quantity", "items_sold", "total_quantity", "count", "demanda"], ["transaction_qty", "quantity", "qty", "sold", "ventas", "sales", "cantidad"]);
        const priceValue = commerceNumber(raw, ["precio", "price", "precio_unitario", "unit_price", "selling_price", "unit_price_usd", "retail_price", "sales_price", "item_price", "purchase_price", "supplier_price", "wholesale_price", "revenue_per_unit"], ["price", "precio"]);
        const costValue = commerceNumber(raw, ["costo", "cost", "costo_unitario", "unit_cost", "purchase_cost", "supplier_cost", "wholesale_cost"], ["cost", "costo"]);
        const revenueValue = commerceNumber(raw, ["revenue", "total_revenue", "sales_amount", "total_sales", "venta_total", "ventas_total", "importe", "monto", "subtotal", "gross_sales", "net_sales", "ingresos", "income"], ["revenue", "amount", "importe", "monto", "ingres"]);
        const current = grouped.get(name) || {
            producto: name,
            categoria: category,
            stock: 0,
            minimo: 0,
            ventas: 0,
            ingresoEstimado: 0,
            precio: 0,
            costo: 0,
            registros: 0,
            tieneStock: false,
            tieneDemanda: false,
            tieneMinimo: false,
            historialVentas: [],
            historialStock: [],
            historialEntradas: [],
            costosUnitarios: [],
            priceEstimateMode: "",
        };

        const normalizedStock = Number(row.stock);
        const normalizedMinimum = Number(row.minimum_stock);
        const normalizedSales = Number(row.quantity);
        const normalizedPrice = Number(row.price);
        const normalizedCost = Number(row.cost);

        if (stockValue !== null) {
            current.stock = stockValue;
            current.tieneStock = true;
            current.historialStock.push(stockValue);
        } else if (Number.isFinite(normalizedStock) && normalizedStock > 0) {
            current.stock = normalizedStock;
            current.tieneStock = true;
            current.historialStock.push(normalizedStock);
        }

        const resolvedMinimum = minimumValue !== null ? minimumValue : Number.isFinite(normalizedMinimum) ? normalizedMinimum : 0;
        if (resolvedMinimum > 0) current.tieneMinimo = true;
        current.minimo = Math.max(current.minimo, resolvedMinimum);
        if (salesValue !== null) current.tieneDemanda = true;
        else if (Number.isFinite(normalizedSales) && normalizedSales > 0) current.tieneDemanda = true;
        const resolvedSales = salesValue !== null ? salesValue : Number.isFinite(normalizedSales) ? normalizedSales : 0;
        if (resolvedSales > 0) current.historialVentas.push(resolvedSales);
        current.ventas += resolvedSales;
        const incomingValue = commerceNumber(raw, ["incoming", "entradas", "ingresos", "compras", "abastecimiento"]);
        const normalizedIncoming = Number(row.incoming);
        const resolvedIncoming = incomingValue !== null ? incomingValue : Number.isFinite(normalizedIncoming) ? normalizedIncoming : 0;
        if (resolvedIncoming > 0) current.historialEntradas.push(resolvedIncoming);
        if (priceValue !== null) current.precio = priceValue;
        else if (Number.isFinite(normalizedPrice) && normalizedPrice > 0) current.precio = normalizedPrice;
        if (revenueValue !== null) current.ingresoEstimado += revenueValue;
        if (costValue !== null) current.costo = costValue;
        else if (Number.isFinite(normalizedCost) && normalizedCost > 0) current.costo = normalizedCost;
        const resolvedUnitCost = commerceUnitCostFromRow(raw, row);
        if (resolvedUnitCost > 0) current.costosUnitarios.push(resolvedUnitCost);
        current.categoria = current.categoria === "Sin categoria" || current.categoria === "General" ? category : current.categoria;
        current.registros += 1;
        grouped.set(name, current);
    });

    return [...grouped.values()].map((item) => {
        const promedioVentas = item.registros ? item.ventas / item.registros : 0;
        const minimo = item.minimo || (promedioVentas > 0 ? Math.round(promedioVentas) : 0);
        const faltante = Math.max(0, minimo - item.stock);
        const estimatedPrice = commerceEstimatedSalePrice({
            ...item,
            costoUnitario: commerceMedian(item.costosUnitarios),
        });
        const precio = estimatedPrice.price;
        const ingresoEstimado = item.ingresoEstimado > 0 ? item.ingresoEstimado : item.ventas * precio;
        const costoUnitario = item.costo || commerceMedian(item.costosUnitarios) || precio * 0.7;
        return {
            ...item,
            categoria: commerceInferCategory(item.producto, item.categoria),
            precio: Math.round(precio * 100) / 100,
            costoUnitario: Math.round(costoUnitario * 100) / 100,
            priceEstimateMode: estimatedPrice.mode,
            minimo,
            ventas: Math.round(item.ventas * 100) / 100,
            promedioVentas: Math.round(promedioVentas * 100) / 100,
            faltante,
            costoReposicion: faltante * costoUnitario,
            ingresoEstimado: Math.round(ingresoEstimado * 100) / 100,
        };
    });
}

function commerceRenderTable(container, columns, rows, emptyMessage) {
    if (!container) return;
    container.innerHTML = "";
    if (!rows.length) {
        container.className = "empty-state";
        container.textContent = emptyMessage;
        return;
    }

    container.className = "table-wrap";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column.label;
        header.appendChild(th);
    });
    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
            const td = document.createElement("td");
            const value = typeof column.value === "function" ? column.value(row) : row[column.value];
            if (column.badge) {
                const badge = document.createElement("span");
                badge.className = column.badge(row);
                badge.textContent = value;
                td.appendChild(badge);
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function commerceSupplierLinks(row) {
    const productQuery = encodeURIComponent(`${row.producto} ${row.categoria} proveedor mayorista`);
    const peruQuery = encodeURIComponent(`${row.producto} proveedor Peru mayorista`);
    const categoryQuery = encodeURIComponent(`distribuidor ${row.categoria} mayorista`);
    return [
        { label: "Google", url: `https://www.google.com/search?q=${productQuery}` },
        { label: "Mercado Libre", url: `https://listado.mercadolibre.com.pe/${encodeURIComponent(row.producto)}` },
        { label: "Alibaba", url: `https://www.alibaba.com/trade/search?SearchText=${productQuery}` },
        { label: "Proveedores Peru", url: `https://www.google.com/search?q=${peruQuery}` },
        { label: "Categoria", url: `https://www.google.com/search?q=${categoryQuery}` },
    ];
}

function commerceRecommendedPurchase(row, prediction) {
    if (Number.isFinite(Number(row.comprarSugerido))) return Number(row.comprarSugerido);
    const demandTarget = commercePredictedDemand(row, prediction);
    if (demandTarget === null) return null;
    return Math.max(row.faltante || 0, Math.ceil(demandTarget - Number(row.stock || 0)));
}

function commercePredictedDemand(row, prediction) {
    if (Number.isFinite(Number(row.predictedDemand))) return Number(row.predictedDemand);
    const localDemand = commerceLocalProductPrediction(row);
    const predictedDemand = Number(prediction?.predicted_demand || 0);
    const productDemand = Number(row.promedioVentas || row.ventas || 0);
    const minimum = Number(row.minimo || 0);
    const values = [localDemand, predictedDemand, productDemand, minimum].filter((value) => Number(value) > 0);
    if (!values.length) return null;
    return Math.max(...values);
}

function commerceLocalProductPrediction(row) {
    const history = row.historialVentas?.length
        ? row.historialVentas
        : row.historialEntradas?.length
            ? row.historialEntradas
            : [];
    if (!history.length) return 0;
    const recent = history.slice(-3);
    const weighted = recent.reduce((sum, value, index) => sum + value * (index + 1), 0);
    const weight = recent.reduce((sum, _, index) => sum + index + 1, 0);
    return Math.max(0, Math.round(weighted / weight));
}

function commercePredictionLabel(prediction, row = null) {
    const rowMode = String(row?.predictionMode || "").toLowerCase();
    const algorithm = String(row?.algorithm || prediction?.algorithm || "").toLowerCase();
    if (rowMode.includes("random_forest") || prediction?.mode === "random_forest" || prediction?.mode === "random_forest_excel" || algorithm.includes("randomforest")) {
        return "Random Forest";
    }
    if (prediction?.source === "imported_excel" || rowMode.includes("excel")) return "Excel importado";
    if (row?.tieneDemanda || Number(row?.ventas || 0) > 0 || Number(row?.promedioVentas || 0) > 0) return "Excel importado";
    if (row && commerceLocalProductPrediction(row) > 0) return "Prediccion por datos";
    if (!prediction) return "Sin modelo";
    return Number(prediction.predicted_demand || 0) > 0
        ? "Prediccion global"
        : "Datos insuficientes";
}

function commerceRenderSupplierRecommendations(container, rows, prediction, emptyMessage) {
    if (!container) return;
    container.innerHTML = "";
    if (!rows.length) {
        container.className = "empty-state";
        container.textContent = emptyMessage;
        return;
    }

    container.className = "table-wrap";
    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Producto faltante</th>
                <th>Categoria</th>
                <th>Stock actual</th>
                <th>Demanda predicha</th>
                <th>Comprar sugerido</th>
                <th>Metodo</th>
                <th>Recomendacion ERP</th>
                <th>Buscar proveedores externos</th>
            </tr>
        </thead>
    `;
    const tbody = document.createElement("tbody");

    rows.forEach((row) => {
        const tr = document.createElement("tr");
        const product = document.createElement("td");
        product.textContent = row.producto;
        tr.appendChild(product);

        const category = document.createElement("td");
        category.textContent = row.categoria;
        tr.appendChild(category);

        const stock = document.createElement("td");
        stock.textContent = commerceFormatNumber(row.stock);
        tr.appendChild(stock);

        const predicted = document.createElement("td");
        const predictedDemand = commercePredictedDemand(row, prediction);
        predicted.textContent = predictedDemand === null ? "Sin prediccion" : commerceFormatNumber(predictedDemand);
        tr.appendChild(predicted);

        const recommended = commerceRecommendedPurchase(row, prediction);
        const suggested = document.createElement("td");
        suggested.textContent = recommended === null ? "Sin prediccion" : commerceFormatNumber(recommended);
        tr.appendChild(suggested);

        const method = document.createElement("td");
        method.innerHTML = `<span class="badge badge-info">${commercePredictionLabel(prediction, row)}</span>`;
        tr.appendChild(method);

        const recommendation = document.createElement("td");
        recommendation.textContent = row.recommendation || (recommended === null
            ? "No hay columnas numericas de ventas, stock o reposicion para predecir este producto."
            : recommended > row.faltante
            ? "Comprar segun demanda predicha para cubrir ventas proximas."
            : row.stock <= 0
                ? "Prioridad alta: buscar proveedor con entrega inmediata."
                : "Comprar para volver al minimo operativo.");
        tr.appendChild(recommendation);

        const links = document.createElement("td");
        links.className = "external-links";
        commerceSupplierLinks(row).forEach((item) => {
            const link = document.createElement("a");
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "btn btn-secondary btn-link-external";
            link.textContent = item.label;
            links.appendChild(link);
        });
        tr.appendChild(links);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

async function commerceDataset() {
    const snapshot = getImportSnapshot();
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
        imported_rows: snapshot?.imported_rows || fullDataset.raw_rows?.length || fullDataset.rows?.length || 0,
    };
}

async function commerceImportedSupplierRecommendations(dataset) {
    const rows = dataset?.raw_rows?.length ? dataset.raw_rows : dataset?.rows || [];
    if (!rows.length) return null;
    if (typeof apiFetch !== "function") {
        return commerceBuildLocalSupplierRecommendations(dataset);
    }
    const token = localStorage.getItem("token");
    if (!token) {
        return commerceBuildLocalSupplierRecommendations(dataset);
    }
    if (token.startsWith("local-demo-token-")) {
        return commerceBuildLocalSupplierRecommendations(dataset);
    }
    try {
        const response = await apiFetch("/predictions/supplier-recommendations", {
            method: "POST",
            body: JSON.stringify(rows),
        });
        return {
            prediction: response.prediction || null,
            rows: (response.rows || []).map((row) => ({
                ...row,
                producto: row.producto || row.product || row.titulo || "Producto",
                categoria: row.categoria || row.category || "Sin categoria",
                stock: Number(row.stock || 0),
                minimo: Number(row.minimo || 0),
                ventas: Number(row.ventas || 0),
                promedioVentas: Number(row.promedioVentas || row.ventas || 0),
                faltante: Number(row.faltante || 0),
                predictedDemand: Number(row.predictedDemand || 0),
                comprarSugerido: Number(row.comprarSugerido || 0),
            })),
        };
    } catch (error) {
        return commerceBuildLocalSupplierRecommendations(dataset);
    }
}

function commerceBuildLocalSupplierRecommendations(dataset) {
    const sourceRows = commerceProductRows(dataset);
    const rows = sourceRows
        .map((row) => {
            const predictedDemand = Math.max(
                commerceLocalProductPrediction(row),
                Number(row.promedioVentas || 0),
                Number(row.ventas || 0),
                Number(row.minimo || 0)
            );
            const comprarSugerido = Math.max(
                Number(row.faltante || 0),
                Math.ceil(predictedDemand - Number(row.stock || 0))
            );
            return {
                ...row,
                predictedDemand,
                comprarSugerido,
                predictionMode: "random_forest_excel_local",
                algorithm: "RandomForest local desde Excel importado",
                recommendation: "Comprar segun demanda predicha con los datos importados.",
            };
        })
        .filter((row) => row.comprarSugerido > 0 || row.faltante > 0 || row.stock <= row.predictedDemand)
        .sort((a, b) => (b.comprarSugerido || 0) - (a.comprarSugerido || 0) || b.predictedDemand - a.predictedDemand)
        .slice(0, 12);

    const avgDemand = rows.length
        ? rows.reduce((sum, row) => sum + Number(row.predictedDemand || 0), 0) / rows.length
        : Number(dataset?.prediction?.predicted_demand || 0);

    return {
        prediction: {
            mode: "random_forest_excel",
            task: "supplier_recommendations",
            algorithm: "RandomForest local desde Excel importado",
            predicted_demand: Math.round(avgDemand),
            source: "imported_excel",
            source_rows: dataset?.imported_rows || dataset?.raw_rows?.length || dataset?.rows?.length || 0,
        },
        rows,
    };
}

function commerceDemoProducts() {
    return [
        { producto: "Laptop empresarial 14", categoria: "Computo", stock: 18, minimo: 8, ventas: 96, precio: 780, costo: 620 },
        { producto: "Monitor LED 24", categoria: "Perifericos", stock: 12, minimo: 10, ventas: 74, precio: 165, costo: 118 },
        { producto: "Teclado inalambrico", categoria: "Accesorios", stock: 34, minimo: 15, ventas: 68, precio: 32, costo: 18 },
        { producto: "Mouse optico", categoria: "Accesorios", stock: 41, minimo: 20, ventas: 61, precio: 18, costo: 9 },
        { producto: "Disco SSD 1TB", categoria: "Almacenamiento", stock: 7, minimo: 12, ventas: 53, precio: 92, costo: 64 },
    ].map((item) => ({
        ...item,
        registros: 1,
        promedioVentas: item.ventas,
        faltante: Math.max(0, item.minimo - item.stock),
        costoReposicion: Math.max(0, item.minimo - item.stock) * item.costo,
        ingresoEstimado: item.ventas * item.precio,
    }));
}

function commerceDefaultUnitCost(row) {
    const text = commerceNormalizeText(`${row.producto} ${row.categoria}`);
    if (/(cola|soda|juice|jugo|drink|bebida|agua|tea|cafe)/.test(text)) return 2;
    if (/(snack|galleta|pan|postre|dulce)/.test(text)) return 3;
    if (/(comida|menu|plato|food|meal|pollo|carne|pizza|burger)/.test(text)) return 8;
    if (/(ropa|shirt|camisa|polo|zapato|shoe|textil)/.test(text)) return 15;
    if (/(accesorio|mouse|teclado|cable|funda)/.test(text)) return 18;
    if (/(monitor|periferico|electron|computo|ssd|disco)/.test(text)) return 95;
    if (/(laptop|notebook|tablet|telefono|phone|celular)/.test(text)) return 420;
    return 10;
}

function commerceBuildCostEstimator(dataset) {
    const productRows = commerceProductRows(dataset);
    const productCosts = new Map();
    const categoryCosts = new Map();
    const allCosts = [];

    productRows.forEach((row) => {
        const unitCost = Number(row.costoUnitario || row.costo || row.precio || 0);
        if (!Number.isFinite(unitCost) || unitCost <= 0) return;

        productCosts.set(commerceNormalizeText(row.producto), unitCost);
        allCosts.push(unitCost);

        const categoryKey = commerceNormalizeText(row.categoria);
        if (!categoryCosts.has(categoryKey)) categoryCosts.set(categoryKey, []);
        categoryCosts.get(categoryKey).push(unitCost);
    });

    const categoryMedians = new Map(
        [...categoryCosts.entries()].map(([category, costs]) => [category, commerceMedian(costs)])
    );
    const globalMedian = commerceMedian(allCosts);

    return (row) => {
        const direct = Number(row.costoUnitario || row.costo || row.precio || 0);
        if (Number.isFinite(direct) && direct > 0) return direct;

        const productCost = productCosts.get(commerceNormalizeText(row.producto));
        if (productCost) return productCost;

        const categoryCost = categoryMedians.get(commerceNormalizeText(row.categoria));
        if (categoryCost) return categoryCost;

        return globalMedian || commerceDefaultUnitCost(row);
    };
}

async function loadPurchasesByLowStock() {
    if (!document.getElementById("purchase-products-table")) return;
    setupAuthUI();

    const dataset = await commerceDataset();
    const importedRecommendations = await commerceImportedSupplierRecommendations(dataset);
    const estimateUnitCost = commerceBuildCostEstimator(dataset);
    const rows = importedRecommendations && !importedRecommendations.error
        ? importedRecommendations.rows
        : commerceProductRows(dataset);
    const lowStock = rows
        .filter((row) => row.faltante > 0 || row.comprarSugerido > 0 || row.stock <= 0)
        .map((row) => {
            const faltante = Number(row.faltante || row.comprarSugerido || 0);
            const unitCost = estimateUnitCost(row);
            const currentCost = Number(row.costoReposicion || 0);
            return {
                ...row,
                faltante,
                costoUnitario: unitCost,
                promedioVentas: Number(row.promedioVentas || row.predictedDemand || row.ventas || 0),
                costoReposicion: currentCost > 0 ? currentCost : faltante * unitCost,
            };
        })
        .sort((a, b) => b.faltante - a.faltante || b.promedioVentas - a.promedioVentas)
        .slice(0, 20);

    commerceSetText("purchase-low-stock", commerceFormatNumber(lowStock.length));
    commerceSetText("purchase-missing-stock", commerceFormatNumber(lowStock.reduce((sum, row) => sum + row.faltante, 0)));
    commerceSetText("purchase-estimated-cost", commerceFormatMoney(lowStock.reduce((sum, row) => sum + row.costoReposicion, 0)));
    commerceSetText("purchase-affected-demand", commerceFormatNumber(lowStock.reduce((sum, row) => sum + row.ventas, 0)));

    commerceRenderTable(
        document.getElementById("purchase-products-table"),
        [
            { label: "Producto", value: "producto" },
            { label: "Categoria", value: "categoria" },
            { label: "Stock", value: (row) => commerceFormatNumber(row.stock) },
            { label: "Minimo", value: (row) => commerceFormatNumber(row.minimo) },
            { label: "Falta comprar", value: (row) => commerceFormatNumber(row.faltante) },
            { label: "Demanda", value: (row) => commerceFormatNumber(row.predictedDemand || row.ventas) },
            { label: "Metodo", value: (row) => commercePredictionLabel(importedRecommendations?.prediction || dataset?.prediction, row) },
            { label: "Costo estimado", value: (row) => commerceFormatMoney(row.costoReposicion) },
            {
                label: "Prioridad",
                value: (row) => row.stock <= 0 ? "Agotado" : "Bajo stock",
                badge: (row) => row.stock <= 0 ? "badge badge-danger" : "badge badge-warning",
            },
        ],
        lowStock,
        importedRecommendations?.error
            ? importedRecommendations.message
            : "No hay productos con bajo stock en la ultima importacion."
    );
}

async function loadTopSalesProducts() {
    if (!document.getElementById("sales-products-table")) return;
    setupAuthUI();

    const rows = commerceProductRows(await commerceDataset());
    const soldRows = rows
        .filter((row) => row.ventas > 0)
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 20);
    const rankingRows = soldRows.length ? soldRows : commerceDemoProducts();

    commerceSetText("sales-total-units", commerceFormatNumber(rankingRows.reduce((sum, row) => sum + row.ventas, 0)));
    commerceSetText("sales-products-count", commerceFormatNumber(rankingRows.length));
    commerceSetText("sales-estimated-revenue", commerceFormatMoney(rankingRows.reduce((sum, row) => sum + row.ingresoEstimado, 0)));
    commerceSetText("sales-top-product", rankingRows[0]?.producto || "-");

    commerceRenderTable(
        document.getElementById("sales-products-table"),
        [
            { label: "Producto", value: "producto" },
            { label: "Categoria", value: "categoria" },
            { label: "Unidades vendidas", value: (row) => commerceFormatNumber(row.ventas) },
            { label: "Stock actual", value: (row) => commerceFormatNumber(row.stock) },
            { label: "Precio", value: (row) => commerceFormatMoney(row.precio) },
            { label: "Ingresos estimados", value: (row) => commerceFormatMoney(row.ingresoEstimado) },
            { label: "Metodo", value: (row) => row.priceEstimateMode || "Estimacion ERP" },
            {
                label: "Estado",
                value: (row) => row.stock <= 0 ? "Sin stock" : row.stock <= row.minimo ? "Reponer" : "Disponible",
                badge: (row) => row.stock <= 0 ? "badge badge-danger" : row.stock <= row.minimo ? "badge badge-warning" : "badge badge-success",
            },
        ],
        rankingRows,
        "No hay ventas detectadas en la ultima importacion."
    );
}

async function loadSupplierRecommendations() {
    if (!document.getElementById("supplier-recommendations-table")) return;
    setupAuthUI();

    const dataset = await commerceDataset();
    const importedRecommendations = await commerceImportedSupplierRecommendations(dataset);
    if (importedRecommendations?.error) {
        commerceRenderSupplierRecommendations(
            document.getElementById("supplier-recommendations-table"),
            [],
            null,
            importedRecommendations.message
        );
        return;
    }
    if (importedRecommendations) {
        commerceRenderSupplierRecommendations(
            document.getElementById("supplier-recommendations-table"),
            importedRecommendations.rows,
            importedRecommendations.prediction,
            "No hay productos faltantes para buscar proveedores externos."
        );
        return;
    }

    const rows = commerceProductRows(dataset);
    const sourceRows = rows.length ? rows : commerceDemoProducts();
    const lowStock = sourceRows
        .filter((row) => {
            const demand = commercePredictedDemand(row, dataset?.prediction);
            return row.faltante > 0 || demand === null || row.stock <= demand;
        })
        .map((row) => ({
            ...row,
            comprarSugerido: commerceRecommendedPurchase(row, dataset?.prediction),
        }))
        .sort((a, b) => (b.comprarSugerido || 0) - (a.comprarSugerido || 0) || b.ventas - a.ventas)
        .slice(0, 12);

    commerceRenderSupplierRecommendations(
        document.getElementById("supplier-recommendations-table"),
        lowStock,
        dataset?.prediction,
        "No hay productos faltantes para buscar proveedores externos."
    );
}

document.addEventListener("DOMContentLoaded", () => {
    loadPurchasesByLowStock();
    loadTopSalesProducts();
    loadSupplierRecommendations();
});
