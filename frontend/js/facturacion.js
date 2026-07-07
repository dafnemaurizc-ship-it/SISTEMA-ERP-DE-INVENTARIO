const BILLING_DOCS_KEY = "novaris:billing-documents";
const IGV_RATE = 0.18;
let billingProducts = [];
let billingCart = [];
let lastReceipt = null;

function billingMoney(value) {
    return `S/ ${new Intl.NumberFormat("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))}`;
}

function billingNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function billingEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function billingCurrentBusiness() {
    let user = {};
    try {
        user = JSON.parse(localStorage.getItem("user_data") || "{}");
    } catch (error) {
        user = {};
    }

    const name = String(
        user.company_name ||
        user.companyName ||
        user.business_name ||
        user.razon_social ||
        user.client_name ||
        user.nombre ||
        ""
    ).trim();
    const ruc = String(user.ruc || user.company_ruc || "").trim();

    return {
        name: name || "Mi negocio",
        detail: ruc ? `RUC ${ruc} - Novaris ERP` : "Gestion comercial - Novaris ERP",
    };
}

function billingDocs() {
    try {
        return JSON.parse(localStorage.getItem(BILLING_DOCS_KEY) || "[]");
    } catch (error) {
        return [];
    }
}

function saveBillingDocs(docs) {
    localStorage.setItem(BILLING_DOCS_KEY, JSON.stringify(docs.slice(0, 80)));
}

function billingDocumentNumber(type, docs) {
    const prefix = type === "factura" ? "F001" : "B001";
    const count = docs.filter((doc) => doc.type === type).length + 1;
    return `${prefix}-${String(count).padStart(6, "0")}`;
}

function billingSetMessage(message, mode = "info") {
    const box = document.getElementById("billing-message");
    if (!box) return;
    box.textContent = message || "";
    box.className = message ? `billing-message ${mode}` : "billing-message";
}

function billingTotals() {
    const total = billingCart.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const subtotal = total / (1 + IGV_RATE);
    const igv = total - subtotal;
    return { subtotal, igv, total };
}

function billingProductKey(row, index) {
    return commerceNormalizeText(`${row.producto}-${row.categoria}-${index}`);
}

function billingDocumentDigits(value) {
    return String(value || "").replace(/\D/g, "");
}

function billingDocumentKind(value) {
    const digits = billingDocumentDigits(value);
    if (!digits) return "empty";
    if (digits.length === 8) return "dni";
    if (digits.length === 11) return digits.startsWith("10") ? "ruc_natural" : "ruc";
    if (digits.length >= 9 && digits.length <= 12) return "ce";
    return "invalid";
}

function billingSelectedIdType() {
    return document.getElementById("billing-id-type")?.value || "dni";
}

function billingDocumentMaxLength() {
    const idType = billingSelectedIdType();
    if (idType === "dni") return 8;
    if (idType === "ruc") return 11;
    return 12;
}

function billingDocumentMinLength() {
    const idType = billingSelectedIdType();
    if (idType === "dni") return 8;
    if (idType === "ruc") return 11;
    return 9;
}

function billingDocumentLabel() {
    const idType = billingSelectedIdType();
    if (idType === "dni") return { label: "DNI", placeholder: "8 digitos" };
    if (idType === "ruc") return { label: "RUC", placeholder: "11 digitos" };
    return { label: "Carnet extranjeria", placeholder: "9 a 12 digitos" };
}

function billingSyncDocumentInput() {
    const input = document.getElementById("billing-customer-doc");
    if (!input) return;
    const maxLength = billingDocumentMaxLength();
    const config = billingDocumentLabel();
    input.maxLength = maxLength;
    input.placeholder = config.placeholder;
    input.value = billingDocumentDigits(input.value).slice(0, maxLength);
    const label = document.getElementById("billing-customer-doc-label");
    if (label) label.textContent = config.label;
}

function billingBeforeDocumentInput(event) {
    const input = event.currentTarget;
    const value = String(event.data || "");
    if (!value) return;
    if (/\D/.test(value)) {
        event.preventDefault();
        return;
    }

    const maxLength = billingDocumentMaxLength();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = `${input.value.slice(0, start)}${value}${input.value.slice(end)}`;
    if (billingDocumentDigits(nextValue).length > maxLength) {
        event.preventDefault();
    }
}

function billingPasteDocumentInput(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const pasted = billingDocumentDigits(event.clipboardData?.getData("text") || "");
    const maxLength = billingDocumentMaxLength();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = `${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`;
    input.value = billingDocumentDigits(nextValue).slice(0, maxLength);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function billingUpdateIdTypeOptions(type) {
    const idType = document.getElementById("billing-id-type");
    if (!idType) return;
    const current = idType.value;
    const options = type === "factura"
        ? [{ value: "ruc", text: "RUC" }]
        : [
            { value: "dni", text: "DNI" },
            { value: "ce", text: "Carnet extranjeria" },
        ];

    idType.innerHTML = "";
    options.forEach(({ value, text }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        idType.appendChild(option);
    });

    if (type === "factura") {
        idType.value = "ruc";
        idType.disabled = true;
    } else {
        idType.disabled = false;
        idType.value = options.some((opt) => opt.value === current) ? current : "dni";
    }
}

function billingSyncDocumentTypeControls() {
    const type = document.getElementById("billing-doc-type")?.value || "boleta";
    const customerName = document.getElementById("billing-customer-name");

    billingUpdateIdTypeOptions(type);

    if (customerName) {
        customerName.placeholder = type === "factura" ? "Razon social" : "Cliente final";
    }
    billingSyncDocumentInput();
}

async function billingLoadProducts() {
    const dataset = await commerceDataset();
    const rows = commerceProductRows(dataset);
    billingProducts = rows.map((row, index) => ({
        ...row,
        id: billingProductKey(row, index),
        stock: Math.max(0, Math.round(billingNumber(row.stock))),
        price: Math.max(0, billingNumber(row.precio)),
        category: row.categoria || "General",
        code: row.sku || row.codigo || row.producto,
    }));

    if (!billingProducts.length) {
        billingProducts = commerceDemoProducts().map((row, index) => ({
            ...row,
            id: billingProductKey(row, index),
            stock: Math.max(0, Math.round(billingNumber(row.stock))),
            price: Math.max(0, billingNumber(row.precio)),
            category: row.categoria || "General",
            code: row.producto,
        }));
        billingSetMessage("No hay archivo importado; se muestran productos demo para probar la emision.", "warning");
    }

    document.getElementById("billing-source-badge").textContent = billingProducts.length
        ? `${billingProducts.length} productos`
        : "Sin archivo";
    billingPopulateCategories();
    billingRenderProducts();
    billingRenderAll();
}

function billingPopulateCategories() {
    const select = document.getElementById("billing-category-filter");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Todas</option>';
    [...new Set(billingProducts.map((product) => product.category).filter(Boolean))]
        .sort()
        .forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            option.selected = category === current;
            select.appendChild(option);
        });
}

function billingFilteredProducts() {
    const query = commerceNormalizeText(document.getElementById("billing-product-search")?.value || "");
    const category = document.getElementById("billing-category-filter")?.value || "";
    return billingProducts.filter((product) => {
        const text = commerceNormalizeText([
            product.producto,
            product.category,
            product.code,
            product.priceEstimateMode,
        ].join(" "));
        if (query && !text.includes(query)) return false;
        if (category && product.category !== category) return false;
        return true;
    });
}

function billingRenderProducts() {
    const container = document.getElementById("billing-products-table");
    if (!container) return;
    const rows = billingFilteredProducts().slice(0, 40);
    container.innerHTML = "";
    if (!rows.length) {
        container.className = "empty-state";
        container.textContent = "No hay productos que coincidan con la busqueda.";
        return;
    }

    container.className = "table-wrap billing-products-table";
    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr><th>Producto</th><th>Stock</th><th>Precio</th><th>Accion</th></tr>
        </thead>
    `;
    const tbody = document.createElement("tbody");
    rows.forEach((product) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td title="${billingEscape(product.producto)}"><strong>${billingEscape(product.producto)}</strong><span>${billingEscape(product.category)} · ${billingEscape(product.priceEstimateMode || "Precio ERP")}</span></td>
            <td>${commerceFormatNumber(product.stock)}</td>
            <td>${billingMoney(product.price)}</td>
        `;
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-primary btn-link-external";
        button.textContent = "Agreg.";
        button.disabled = product.stock <= 0;
        button.addEventListener("click", () => billingAddProduct(product.id));
        action.appendChild(button);
        tr.appendChild(action);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function billingAddProduct(productId) {
    const product = billingProducts.find((item) => item.id === productId);
    if (!product) return;
    const current = billingCart.find((item) => item.id === productId);
    const used = current ? current.quantity : 0;
    if (product.stock > 0 && used >= product.stock) {
        billingSetMessage("No puedes vender mas unidades que el stock importado.", "danger");
        return;
    }
    if (current) current.quantity += 1;
    else {
        billingCart.push({
            id: product.id,
            product: product.producto,
            category: product.category,
            stock: product.stock,
            price: product.price,
            quantity: 1,
        });
    }
    billingSetMessage("");
    billingRenderAll();
}

function billingUpdateQuantity(productId, quantity) {
    const item = billingCart.find((row) => row.id === productId);
    if (!item) return;
    const next = Math.max(1, Math.round(billingNumber(quantity)));
    item.quantity = Math.min(next, item.stock || next);
    billingRenderAll();
}

function billingRemoveProduct(productId) {
    billingCart = billingCart.filter((item) => item.id !== productId);
    billingRenderAll();
}

function billingRenderCart() {
    const container = document.getElementById("billing-cart-table");
    if (!container) return;
    container.innerHTML = "";
    if (!billingCart.length) {
        container.className = "empty-state";
        container.textContent = "Agrega productos desde la lista.";
        return;
    }

    container.className = "table-wrap billing-cart-table";
    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr><th>N</th><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th><th></th></tr>
        </thead>
    `;
    const tbody = document.createElement("tbody");
    billingCart.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${billingEscape(item.product)}</td>
            <td></td>
            <td>${billingMoney(item.price)}</td>
            <td>${billingMoney(item.quantity * item.price)}</td>
        `;
        const quantityCell = tr.children[2];
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.max = String(item.stock || 9999);
        input.value = String(item.quantity);
        input.className = "billing-qty";
        input.addEventListener("change", () => billingUpdateQuantity(item.id, input.value));
        quantityCell.appendChild(input);

        const removeCell = document.createElement("td");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-link billing-remove";
        remove.textContent = "Quitar";
        remove.addEventListener("click", () => billingRemoveProduct(item.id));
        removeCell.appendChild(remove);
        tr.appendChild(removeCell);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function billingRenderTotals() {
    const totals = billingTotals();
    document.getElementById("billing-subtotal").textContent = billingMoney(totals.subtotal);
    document.getElementById("billing-igv").textContent = billingMoney(totals.igv);
    document.getElementById("billing-total").textContent = billingMoney(totals.total);
    document.getElementById("billing-stat-cart").textContent = billingMoney(totals.total);
}

function billingRenderStats() {
    const docs = billingDocs();
    document.getElementById("billing-stat-products").textContent = commerceFormatNumber(billingProducts.length);
    document.getElementById("billing-stat-docs").textContent = commerceFormatNumber(docs.length);
    document.getElementById("billing-stat-cash").textContent = billingMoney(docs.reduce((sum, doc) => sum + doc.total, 0));
}

function billingRenderHistory() {
    const container = document.getElementById("billing-history-table");
    if (!container) return;
    const docs = billingDocs();
    container.innerHTML = "";
    if (!docs.length) {
        container.className = "empty-state";
        container.textContent = "Sin comprobantes emitidos.";
        return;
    }
    container.className = "table-wrap";
    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr><th>Comprobante</th><th>Cliente</th><th>Documento</th><th>Fecha</th><th>Total</th><th>Estado</th></tr>
        </thead>
    `;
    const tbody = document.createElement("tbody");
    docs.slice(0, 12).forEach((doc) => {
        const tr = document.createElement("tr");
        tr.tabIndex = 0;
        tr.setAttribute("role", "button");
        tr.title = `Ver comprobante ${doc.number}`;
        tr.innerHTML = `
            <td>${doc.number}</td>
            <td>${billingEscape(doc.customerName)}</td>
            <td>${billingEscape(doc.customerDoc || "-")}</td>
            <td>${new Date(doc.createdAt).toLocaleString("es-PE")}</td>
            <td>${billingMoney(doc.total)}</td>
            <td><span class="badge badge-success">Emitido</span></td>
        `;
        const openReceipt = () => {
            lastReceipt = doc;
            billingRenderReceipt(doc);
        };
        tr.addEventListener("click", openReceipt);
        tr.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openReceipt();
            }
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function billingValidate() {
    const type = document.getElementById("billing-doc-type").value;
    const idType = billingSelectedIdType();
    const customerName = document.getElementById("billing-customer-name").value.trim() || "Cliente final";
    const customerDoc = document.getElementById("billing-customer-doc").value.trim();
    const digits = billingDocumentDigits(customerDoc);
    const minLength = billingDocumentMinLength();
    const maxLength = billingDocumentMaxLength();
    if (!billingCart.length) return "Agrega al menos un producto.";
    if (idType === "dni" && digits.length !== 8) return "El DNI debe tener exactamente 8 digitos.";
    if (idType === "ruc" && digits.length !== 11) return "El RUC debe tener exactamente 11 digitos.";
    if (idType === "ce" && (digits.length < 9 || digits.length > 12)) return "El Carnet de Extranjeria debe tener entre 9 y 12 digitos.";
    if (digits.length < minLength || digits.length > maxLength) return "El documento no cumple con la longitud configurada.";
    if (type === "factura" && customerName.toLowerCase() === "cliente final") return "Para factura ingresa la razon social.";
    return "";
}

function billingEmitDocument() {
    const error = billingValidate();
    if (error) {
        billingSetMessage(error, "danger");
        return;
    }

    const docs = billingDocs();
    const type = document.getElementById("billing-doc-type").value;
    const totals = billingTotals();
    const business = billingCurrentBusiness();
    const receipt = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        type,
        number: billingDocumentNumber(type, docs),
        issuerName: business.name,
        issuerDetail: business.detail,
        customerName: document.getElementById("billing-customer-name").value.trim() || "Cliente final",
        customerDoc: document.getElementById("billing-customer-doc").value.trim(),
        payment: document.getElementById("billing-payment").value,
        createdAt: new Date().toISOString(),
        items: billingCart.map((item) => ({ ...item })),
        subtotal: totals.subtotal,
        igv: totals.igv,
        total: totals.total,
    };
    docs.unshift(receipt);
    saveBillingDocs(docs);
    billingUpsertClient(receipt.customerName, receipt.customerDoc);
    lastReceipt = receipt;
    billingRenderReceipt(receipt);
    billingCart = [];
    billingResetClientForm();
    billingSetMessage(`${receipt.type === "factura" ? "Factura" : "Boleta"} ${receipt.number} generada correctamente.`, "success");
    billingRenderAll();
}

function billingRenderReceipt(receipt) {
    const container = document.getElementById("billing-receipt-preview");
    if (!container || !receipt) return;
    const documentTitle = receipt.type === "factura" ? "FACTURA" : "BOLETA DE VENTA";
    const business = billingCurrentBusiness();
    const issuerName = receipt.issuerName || business.name;
    const issuerDetail = receipt.issuerDetail || business.detail;
    container.className = "billing-receipt";
    container.innerHTML = `
        <div class="receipt-brand-row">
            <div class="receipt-brand">
                <strong>${billingEscape(issuerName)}</strong>
                <span>${billingEscape(issuerDetail)}</span>
            </div>
            <div class="receipt-document-box">
                <strong>${documentTitle}</strong>
                <span>${receipt.number}</span>
            </div>
        </div>

        <div class="receipt-info-strip">
            <div><span>Cliente:</span><strong>${billingEscape(receipt.customerName)}</strong></div>
            <div><span>RUC / DNI / CE:</span><strong>${billingEscape(receipt.customerDoc || "-")}</strong></div>
            <div><span>Fecha de emision:</span><strong>${new Date(receipt.createdAt).toLocaleString("es-PE")}</strong></div>
            <div><span>Atendido por:</span><strong>Novaris ERP</strong></div>
            <div><span>Forma de pago:</span><strong>${billingEscape(receipt.payment)}</strong></div>
        </div>

        <table class="receipt-items-table">
            <thead><tr><th>N</th><th>Descripcion</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th></tr></thead>
            <tbody>
                ${receipt.items.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${billingEscape(item.product)}</td>
                        <td>${item.quantity}</td>
                        <td>${billingMoney(item.price)}</td>
                        <td>${billingMoney(item.quantity * item.price)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>

        <div class="receipt-summary">
            <div><span>Op. Gravada:</span><strong>${billingMoney(receipt.subtotal)}</strong></div>
            <div><span>IGV (18%):</span><strong>${billingMoney(receipt.igv)}</strong></div>
            <div class="receipt-total"><span>TOTAL:</span><strong>${billingMoney(receipt.total)}</strong></div>
        </div>

        <p class="receipt-footer">Gracias por su compra. Documento generado por Novaris ERP el ${new Date(receipt.createdAt).toLocaleString("es-PE")}.</p>
    `;
}

function billingClear() {
    billingCart = [];
    billingSetMessage("");
    billingRenderAll();
}

function billingResetClientForm() {
    const docType = document.getElementById("billing-doc-type");
    const idType = document.getElementById("billing-id-type");
    const customerName = document.getElementById("billing-customer-name");
    const customerDoc = document.getElementById("billing-customer-doc");
    const payment = document.getElementById("billing-payment");
    if (docType) docType.value = "boleta";
    if (idType) {
        idType.disabled = false;
        idType.value = "dni";
    }
    if (customerName) {
        customerName.value = "";
        customerName.placeholder = "Cliente final";
    }
    if (customerDoc) {
        customerDoc.value = "";
        customerDoc.placeholder = "8 digitos";
        customerDoc.maxLength = 8;
    }
    if (payment) payment.value = "Efectivo";
    billingSyncDocumentInput();
}

// Sync issued receipts with local relations (clients) store used by clientes-proveedores
const RELATIONS_KEY = "novaris_relations";
function billingUpsertClient(name, doc) {
    try {
        const digits = billingDocumentDigits(doc || "");
        const relationsRaw = localStorage.getItem(RELATIONS_KEY) || "[]";
        const relations = JSON.parse(relationsRaw);
        const existing = relations.findIndex((r) => (r.documento || "") === (digits || doc || ""));
        const relation = {
            tipo: "cliente",
            nombre: String(name || "Cliente final").trim() || "Cliente final",
            documento: digits || String(doc || "").trim(),
            email: "",
            estado: "Activo",
            created_at: new Date().toISOString(),
        };
        if (existing >= 0) {
            relations[existing] = Object.assign({}, relations[existing], {
                nombre: relation.nombre,
                documento: relation.documento,
                estado: relation.estado,
            });
        } else {
            relations.unshift(relation);
        }
        localStorage.setItem(RELATIONS_KEY, JSON.stringify(relations.slice(0, 80)));
        if (typeof window.renderRelations === "function") {
            try { window.renderRelations(); } catch (e) { /* ignore */ }
        }
    } catch (e) {
        console.error("billingUpsertClient error:", e);
    }
}

function billingPrintReceipt() {
    if (!lastReceipt) {
        billingSetMessage("Genera o selecciona un comprobante antes de imprimir.", "warning");
        return;
    }
    window.print();
}

function billingRenderAll() {
    billingRenderCart();
    billingRenderTotals();
    billingRenderStats();
    billingRenderHistory();
}

document.addEventListener("DOMContentLoaded", () => {
    billingLoadProducts();
    document.getElementById("billing-product-search")?.addEventListener("input", billingRenderProducts);
    document.getElementById("billing-category-filter")?.addEventListener("change", billingRenderProducts);
    const documentInput = document.getElementById("billing-customer-doc");
    documentInput?.addEventListener("beforeinput", billingBeforeDocumentInput);
    documentInput?.addEventListener("paste", billingPasteDocumentInput);
    documentInput?.addEventListener("input", billingSyncDocumentInput);
    document.getElementById("billing-id-type")?.addEventListener("change", billingSyncDocumentInput);
    document.getElementById("billing-clear")?.addEventListener("click", billingClear);
    document.getElementById("billing-emit")?.addEventListener("click", billingEmitDocument);
    document.getElementById("billing-print")?.addEventListener("click", billingPrintReceipt);
    document.getElementById("billing-doc-type")?.addEventListener("change", billingSyncDocumentTypeControls);
    billingSyncDocumentTypeControls();
});
