const RELATIONS_KEY = "novaris_relations";

function getRelations() {
    try {
        return JSON.parse(localStorage.getItem(RELATIONS_KEY) || "[]");
    } catch (error) {
        return [];
    }
}

function saveRelations(relations) {
    localStorage.setItem(RELATIONS_KEY, JSON.stringify(relations));
}

function relationStatusBadge(status) {
    const className = status === "Activo" ? "badge-success" : status === "Pendiente" ? "badge-warning" : "badge-info";
    const badge = document.createElement("span");
    badge.className = `badge ${className}`;
    badge.textContent = status;
    return badge;
}

function appendRelationCell(tr, value) {
    const td = document.createElement("td");
    td.textContent = value || "-";
    tr.appendChild(td);
    return td;
}

function defaultRelations() {
    return [
        { tipo: "proveedor", nombre: "TechSupply", documento: "20411122233", email: "compras@techsupply.com", estado: "Pendiente" },
        { tipo: "proveedor", nombre: "Distribuidora Norte", documento: "20599887766", email: "ventas@distnorte.pe", estado: "Activo" },
    ];
}

function supplierRows() {
    const saved = getRelations().filter((row) => row.tipo === "proveedor");
    return saved.length ? saved : defaultRelations();
}

function renderRelations() {
    const tbody = document.getElementById("relations-body");
    if (!tbody) return;

    const rows = supplierRows();
    tbody.innerHTML = "";
    rows.forEach((row) => {
        const tr = document.createElement("tr");
        appendRelationCell(tr, row.nombre);
        appendRelationCell(tr, row.documento);
        appendRelationCell(tr, row.email);
        const status = document.createElement("td");
        status.appendChild(relationStatusBadge(row.estado || "Activo"));
        tr.appendChild(status);
        tbody.appendChild(tr);
    });
}

function setupRelationForm() {
    const form = document.getElementById("relation-form");
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const relation = {
            tipo: "proveedor",
            nombre: document.getElementById("nombre-relacion").value.trim(),
            documento: document.getElementById("documento-relacion").value.trim(),
            email: document.getElementById("email-relacion").value.trim(),
            estado: "Activo",
            created_at: new Date().toISOString(),
        };
        if (!relation.nombre) {
            alert("Ingresa el nombre del proveedor.");
            return;
        }
        const relations = [relation, ...getRelations()].slice(0, 50);
        saveRelations(relations);
        form.reset();
        renderRelations();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupRelationForm();
    renderRelations();
});

// Listen to storage events so the relations table updates when other tabs/pages modify it
window.addEventListener("storage", (event) => {
    if (!event) return;
    if (event.key === RELATIONS_KEY || event.key === "novaris_relations_updated_at") {
        try {
            renderRelations();
        } catch (e) {
            // ignore
        }
    }
});

// Polling fallback: detect external changes in case storage events are unreliable
let __novaris_relations_last = localStorage.getItem(RELATIONS_KEY) || "";
setInterval(() => {
    try {
        const current = localStorage.getItem(RELATIONS_KEY) || "";
        if (current !== __novaris_relations_last) {
            __novaris_relations_last = current;
            renderRelations();
        }
    } catch (e) {
        // ignore
    }
}, 2500);

// BroadcastChannel listener (more reliable for same-origin tabs)
try {
    if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("novaris_relations");
        bc.addEventListener("message", (e) => {
            try { console.debug('clientes-proveedores: bc message', e.data); renderRelations(); } catch (err) {}
        });
    }
} catch (e) {
    // ignore
}
