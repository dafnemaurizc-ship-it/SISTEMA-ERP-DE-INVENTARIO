(function () {
    const items = [
        { href: "dashboard.html", label: "Dashboard" },
        { href: "index.html", label: "Productos" },
        { href: "inventario.html", label: "Inventario" },
        { href: "compras.html", label: "Compras" },
        { href: "ventas.html", label: "Ventas" },
        { href: "clientes-proveedores.html", label: "Clientes/Proveedores" },
        { href: "facturacion.html", label: "Facturacion" },
        { href: "importar-datos.html", label: "Prediccion" },
        { href: "reportes.html", label: "Reportes" },
    ];

    function normalize(file) {
        return (file || "").split("/").pop();
    }

    function buildHref(href) {
        const inAdmin = window.location.pathname.includes("/admin/");
        if (!inAdmin) return href;
        return href.startsWith("../") ? href : `../${href}`;
    }

    function renderNav() {
        const nav = document.querySelector(".sidebar-nav");
        if (!nav) return;

        const current = normalize(window.location.pathname) || "dashboard.html";
        nav.innerHTML = "";

        items.forEach((item) => {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = buildHref(item.href);
            link.textContent = item.label;
            if (normalize(item.href) === current) link.className = "active";
            li.appendChild(link);
            nav.appendChild(li);
        });

        const authItem = document.createElement("li");
        if (localStorage.getItem("token")) {
            const button = document.createElement("button");
            button.id = "logout-btn";
            button.type = "button";
            button.textContent = "Cerrar sesion";
            authItem.appendChild(button);
        } else {
            const link = document.createElement("a");
            link.id = "login-link";
            link.href = buildHref("login.html");
            link.textContent = "Acceder";
            authItem.appendChild(link);
        }
        nav.appendChild(authItem);
    }

    document.addEventListener("DOMContentLoaded", renderNav);
})();
