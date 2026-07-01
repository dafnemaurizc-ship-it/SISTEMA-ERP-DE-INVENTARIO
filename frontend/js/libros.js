let currentPage = 0;
const limit = 12;
let catalogItems = [];

function catalogFirstValue(row, aliases, fragments = []) {
    const normalize = typeof normalizeColumnName === "function"
        ? normalizeColumnName
        : (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[-.]/g, "_");
    const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
        acc[normalize(key)] = value;
        return acc;
    }, {});

    for (const alias of aliases) {
        const value = normalized[normalize(alias)];
        if (value !== undefined && value !== null && value !== "") return value;
    }

    for (const fragment of fragments) {
        const normalizedFragment = normalize(fragment);
        const match = Object.entries(normalized).find(([key, value]) =>
            key.includes(normalizedFragment) && value !== undefined && value !== null && value !== ""
        );
        if (match) return match[1];
    }

    return null;
}

function importedRowsToProducts(dataset) {
    const rawRows = dataset?.raw_rows || [];
    const rows = rawRows.length && typeof normalizeErpRows === "function"
        ? normalizeErpRows(rawRows)
        : dataset?.rows || [];
    const grouped = new Map();

    rows.forEach((row, index) => {
        const raw = rawRows[index] || {};
        const title =
            row.product ||
            catalogFirstValue(raw, ["product_name", "product", "producto", "product_detail", "item_name", "menu_item", "item", "description", "descripcion", "sku", "codigo", "product_id"], ["product_detail", "product", "item_name", "menu_item"]) ||
            `Producto ${index + 1}`;
        const code = catalogFirstValue(raw, ["sku", "codigo", "code", "isbn", "product_id", "item_id"]) || title;
        const stock = Number(row.stock || catalogFirstValue(raw, ["stock", "stock_quantity", "inventory_level", "inventory", "inventario", "current_inventory", "on_hand"], ["stock", "inventory", "on_hand"]) || 0);
        const sales = Number(row.quantity || catalogFirstValue(raw, ["ventas", "sales", "sales_volume", "unit_sales", "units_sold", "quantity", "cantidad", "qty", "demanda"], ["sales", "quantity", "ventas"]) || 0);
        const category = row.category || catalogFirstValue(raw, ["category", "categoria", "product_category", "item_category", "product_type", "linea", "region", "department"], ["category", "categoria", "type"]) || "Importado";
        const key = String(code || title).trim().toLowerCase();
        const current = grouped.get(key) || {
            id: grouped.size + 1,
            titulo: title,
            autor: catalogFirstValue(raw, ["brand", "marca", "supplier", "proveedor", "store_id", "store"]) || "Importado",
            isbn: String(code),
            categoria: category,
            stock_total: 0,
            disponibles: 0,
            ventas: 0,
            registros: 0,
            raw,
        };
        current.stock_total = stock || current.stock_total;
        current.disponibles = stock || current.disponibles;
        current.ventas += sales;
        current.registros += 1;
        if (current.categoria === "Importado" && category !== "Importado") current.categoria = category;
        grouped.set(key, current);
    });

    return [...grouped.values()].map((product) => ({
        ...product,
        descripcion: [
            `${product.registros} registro(s) importados`,
            `Ventas/demanda acumulada: ${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(product.ventas || 0)}`,
            `Stock actual: ${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(product.disponibles || 0)}`,
        ].join(" | "),
    }));
}

async function loadImportedCatalog() {
    const fullDataset = typeof getFullImportRows === "function" ? await getFullImportRows() : null;
    const snapshot = typeof getImportSnapshot === "function" ? getImportSnapshot() : null;
    return importedRowsToProducts(fullDataset || snapshot);
}

function getFilteredProducts() {
    const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
    const categoria = document.getElementById("category-select")?.value || "";
    const disponibilidad = document.getElementById("availability-filter")?.value || "";

    return catalogItems.filter((product) => {
        const searchable = [
            product.titulo,
            product.autor,
            product.isbn,
            product.categoria,
            ...Object.values(product.raw || {}),
        ].join(" ").toLowerCase();

        if (q && !searchable.includes(q)) return false;
        if (categoria && product.categoria !== categoria) return false;
        if (disponibilidad === "disponible" && product.disponibles <= 0) return false;
        if (disponibilidad === "agotado" && product.disponibles > 0) return false;
        return true;
    });
}

async function loadLibros(offset = 0) {
    currentPage = Math.floor(offset / limit);
    catalogItems = await loadImportedCatalog();
    if (catalogItems.length) {
        const source = document.getElementById("catalog-source");
        if (source) {
            source.textContent = `Productos desde el Excel/base importada: ${catalogItems.length} productos unicos disponibles.`;
        }
        renderCatalog(offset, getFilteredProducts().length);
        return;
    }

    try {
        const queryParams = new URLSearchParams({ limit, offset });
        const q = document.getElementById("search-input")?.value || "";
        const categoria = document.getElementById("category-select")?.value || "";
        if (q) queryParams.set("q", q);
        if (categoria) queryParams.set("categoria", categoria);

        const response = await apiFetch(`/libros?${queryParams}`);
        catalogItems = response.items || [];
        if (!catalogItems.length) {
            catalogItems = await loadImportedCatalog();
            const source = document.getElementById("catalog-source");
            if (source) {
                source.textContent = catalogItems.length
                    ? `Productos desde el Excel importado: ${catalogItems.length} filas disponibles para busqueda.`
                    : "Productos desde backend: 0 registros cargados.";
            }
            renderCatalog(offset, getFilteredProducts().length);
            return;
        }
        const source = document.getElementById("catalog-source");
        if (source) source.textContent = `Productos desde backend: ${catalogItems.length} registros cargados.`;
        renderCatalog(offset, response.total || catalogItems.length);
    } catch (error) {
        catalogItems = await loadImportedCatalog();
        const source = document.getElementById("catalog-source");
        if (source) {
            source.textContent = catalogItems.length
                ? `Productos desde la base importada: ${catalogItems.length} filas disponibles para busqueda.`
                : "Sin backend ni base importada disponible.";
        }
        if (!catalogItems.length) {
            const container = document.getElementById("books-container");
            if (container) {
                clearChildren(container);
                appendText(container, "div", "Importa datos en Prediccion para poblar el catalogo o enciende el backend.", "empty-state");
            }
            return;
        }
        renderCatalog(offset, getFilteredProducts().length);
    }
}

function renderCatalog(offset = 0, total = 0) {
    populateCategorias(catalogItems);
    const filteredItems = getFilteredProducts();
    const paginated = filteredItems.slice(offset, offset + limit);
    displayLibros(paginated);
    setupPagination(total || filteredItems.length, offset);
}

function populateCategorias(libros) {
    const select = document.getElementById("category-select");
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">Todas</option>';
    const categorias = [...new Set(libros.map((libro) => libro.categoria).filter(Boolean))].sort();
    categorias.forEach((categoria) => {
        const option = document.createElement("option");
        option.value = categoria;
        option.textContent = categoria;
        option.selected = categoria === current;
        select.appendChild(option);
    });
}

function displayLibros(libros) {
    const container = document.getElementById("books-container");
    if (!container) return;

    clearChildren(container);

    if (libros.length === 0) {
        appendText(container, "div", "No se encontraron productos con los filtros seleccionados.", "empty-state");
        return;
    }

    libros.forEach((libro) => {
        const card = document.createElement("article");
        card.className = "book-card";

        const content = document.createElement("div");
        content.className = "book-card-content";
        card.appendChild(content);

        appendText(content, "h3", libro.titulo);

        const meta = document.createElement("div");
        meta.className = "book-meta";
        appendText(meta, "span", `Marca/proveedor: ${libro.autor}`);
        appendText(meta, "span", `Categoria: ${libro.categoria}`);
        if (libro.isbn) appendText(meta, "span", `SKU: ${libro.isbn}`);
        content.appendChild(meta);

        appendText(
            content,
            "span",
            libro.disponibles > 0 ? `${libro.disponibles} disponible(s)` : "Sin disponibilidad",
            libro.disponibles > 0 ? "badge badge-success" : "badge badge-danger"
        );

        if (libro.descripcion) appendText(content, "p", libro.descripcion, "book-description");

        const actions = document.createElement("div");
        actions.className = "actions";
        content.appendChild(actions);
        appendButton(actions, "Ver inventario", "btn btn-primary", () => {
            window.location.href = "/inventario.html";
        });

        container.appendChild(card);
    });
}

function setupPagination(total, currentOffset) {
    const container = document.getElementById("pagination");
    if (!container) return;

    clearChildren(container);
    const totalPages = Math.ceil(total / limit);
    const currentPageNum = Math.floor(currentOffset / limit);
    if (totalPages <= 1) return;

    if (currentPageNum > 0) {
        appendButton(container, "Primera", "", () => renderCatalog(0));
        appendButton(container, "Anterior", "", () => renderCatalog((currentPageNum - 1) * limit));
    }

    for (let index = Math.max(0, currentPageNum - 1); index <= Math.min(totalPages - 1, currentPageNum + 1); index += 1) {
        const offset = index * limit;
        const button = appendButton(container, String(index + 1), "", () => renderCatalog(offset));
        button.disabled = index === currentPageNum;
    }

    if (currentPageNum < totalPages - 1) {
        appendButton(container, "Siguiente", "", () => renderCatalog((currentPageNum + 1) * limit));
        appendButton(container, "Ultima", "", () => renderCatalog((totalPages - 1) * limit));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadLibros(0);

    const searchBtn = document.getElementById("search-btn");
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            renderCatalog(0);
        });
    }

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                renderCatalog(0);
            }
        });
    }

    ["category-select", "availability-filter", "material-filter"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener("change", () => {
                renderCatalog(0);
            });
        }
    });
});
