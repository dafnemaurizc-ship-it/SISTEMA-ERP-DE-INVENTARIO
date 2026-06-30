async function loadMisPrestamos() {
    if (!isLoggedIn()) {
        window.location.href = "/login.html";
        return;
    }

    try {
        const response = await apiFetch("/prestamos/mis-prestamos");
        displayPrestamos(response.items);
    } catch (error) {
        console.error("Error:", error);
        const container = document.getElementById("prestamos-container");
        if (container) {
            clearChildren(container);
            appendText(container, "div", `Error: ${error.message}`, "alert alert-danger");
        }
    }
}

function prestamoEstado(prestamo) {
    if (prestamo.estado === "activo" && prestamo.vencido) {
        return { label: "Pendiente", className: "badge badge-pendiente" };
    }
    if (prestamo.estado === "activo") {
        return { label: "Aprobado", className: "badge badge-aprobado" };
    }
    return { label: "Entregado", className: "badge badge-entregado" };
}

function displayPrestamos(prestamos) {
    const container = document.getElementById("prestamos-container");
    if (!container) return;

    clearChildren(container);

    if (prestamos.length === 0) {
        appendText(container, "div", "No tienes pedidos registrados.", "empty-state");
        return;
    }

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Orden", "Producto solicitado", "Fecha", "Vencimiento", "Estado", "Acciones"].forEach((header) =>
        appendText(headRow, "th", header)
    );
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    prestamos.forEach((prestamo) => {
        const row = document.createElement("tr");
        appendText(row, "td", `PED-${String(prestamo.id).padStart(4, "0")}`);
        appendText(row, "td", prestamo.libro.titulo);
        appendText(row, "td", prestamo.fecha_prestamo);
        appendText(row, "td", prestamo.fecha_devolucion_esperada);

        const estado = prestamoEstado(prestamo);
        const estadoCell = document.createElement("td");
        appendText(estadoCell, "span", estado.label, estado.className);
        row.appendChild(estadoCell);

        const actions = document.createElement("td");
        const detail = document.createElement("a");
        detail.href = "pedido-detalle.html";
        detail.className = "btn btn-secondary";
        detail.textContent = "Ver detalle";
        actions.appendChild(detail);

        if (prestamo.estado === "activo") {
            appendButton(actions, "Devolver", "btn btn-primary", () => devolverPrestamo(prestamo.id));
        }
        row.appendChild(actions);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
}

async function devolverPrestamo(prestamoId) {
    if (!confirm("Deseas registrar la devolucion de este pedido?")) return;

    try {
        await apiFetch(`/prestamos/${prestamoId}/devolver`, {
            method: "PUT",
        });
        alert("Devolucion registrada correctamente");
        loadMisPrestamos();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", loadMisPrestamos);
