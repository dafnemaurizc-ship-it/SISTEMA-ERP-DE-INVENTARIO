async function loadPedidoForm() {
    if (!isLoggedIn()) {
        window.location.href = "/login.html";
        return;
    }

    setupAuthUI();
    hydrateSolicitante();

    try {
        const response = await apiFetch("/libros?limit=100");
        const select = document.getElementById("libro-select");
        clearChildren(select);
        appendSelectOption(select, "", "Selecciona un producto");

        response.items
            .filter((libro) => libro.disponibles > 0)
            .forEach((libro) => {
                appendSelectOption(select, String(libro.id), `${libro.titulo} - ${libro.autor}`);
            });
    } catch (error) {
        alert("Error al cargar catalogo: " + error.message);
    }
}

function hydrateSolicitante() {
    const user = getUserData();
    const solicitante = document.getElementById("solicitante");
    if (user && solicitante) solicitante.value = user.email;
}

function appendSelectOption(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
}

async function submitPedido(event) {
    event.preventDefault();
    const libroId = parseInt(document.getElementById("libro-select").value, 10);

    if (!libroId) {
        alert("Selecciona un producto para enviar la orden.");
        return;
    }

    try {
        await apiFetch("/prestamos", {
            method: "POST",
            body: JSON.stringify({ libro_id: libroId }),
        });
        alert("Pedido enviado correctamente");
        window.location.href = "/mis-prestamos.html";
    } catch (error) {
        alert("Error: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadPedidoForm();
    const form = document.getElementById("pedido-form");
    if (form) form.addEventListener("submit", submitPedido);
});
