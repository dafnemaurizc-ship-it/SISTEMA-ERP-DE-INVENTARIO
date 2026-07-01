(function () {
    const items = [
        { href: "dashboard.html", icon: "📊", label: "Dashboard" },
        { href: "index.html", icon: "📦", label: "Productos" },
        { href: "inventario.html", icon: "🧮", label: "Inventario" },
        { href: "compras.html", icon: "🛒", label: "Compras" },
        { href: "ventas.html", icon: "💰", label: "Ventas" },
        { href: "clientes-proveedores.html", icon: "👥", label: "Clientes/Proveedores" },
        { href: "facturacion.html", icon: "🧾", label: "Facturacion" },
        { href: "importar-datos.html", icon: "🤖", label: "Prediccion" },
        { href: "reportes.html", icon: "📈", label: "Reportes" },
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
            if (normalize(item.href) === current) link.className = "active";
            link.innerHTML = `<span class="nav-icon">${item.icon}</span>${item.label}`;
            li.appendChild(link);
            nav.appendChild(li);
        });

        const authItem = document.createElement("li");
        if (localStorage.getItem("token")) {
            const button = document.createElement("button");
            button.id = "logout-btn";
            button.type = "button";
            button.innerHTML = '<span class="nav-icon">🚪</span>Cerrar sesion';
            authItem.appendChild(button);
        } else {
            const link = document.createElement("a");
            link.id = "login-link";
            link.href = buildHref("login.html");
            link.innerHTML = '<span class="nav-icon">🔐</span>Acceder';
            authItem.appendChild(link);
        }
        nav.appendChild(authItem);
    }

    document.addEventListener("DOMContentLoaded", renderNav);
})();
