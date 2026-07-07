(function () {
    const THEME_KEY = "novaris:theme";
    const items = [
        { href: "dashboard.html", label: "Dashboard" },
        { href: "admin-dashboard.html", label: "Admin", adminOnly: true },
        { href: "index.html", label: "Productos" },
        { href: "inventario.html", label: "Inventario" },
        { href: "compras.html", label: "Compras" },
        { href: "ventas.html", label: "Ventas" },
        { href: "clientes-proveedores.html", label: "Proveedores" },
        { href: "facturacion.html", label: "Facturacion" },
        { href: "importar-datos.html", label: "Prediccion" },
        { href: "reportes.html", label: "Reportes" },
    ];
    const adminItemsFull = [
        { href: "#dashboard-summary", label: "Dashboard" },
        { href: "#empresas", label: "Empresas" },
        { href: "#usuarios", label: "Usuarios" },
        { href: "#planes", label: "Planes" },
        { href: "#suscripciones", label: "Suscripciones" },
        { href: "#pagos", label: "Pagos" },
        { href: "#tickets-soporte", label: "Tickets" },
        { href: "#reportes-ejecutivos", label: "Predicción" },
        { href: "#seguridad", label: "Seguridad" },
        { href: "#auditoria", label: "Auditoría" },
    ];

    const adminItems = adminItemsFull;

    function normalize(file) {
        return (file || "").split("/").pop();
    }

    function buildHref(href) {
        const inAdmin = window.location.pathname.includes("/admin/");
        if (!inAdmin) return href;
        return href.startsWith("../") ? href : `../${href}`;
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
        const button = document.getElementById("theme-toggle");
        if (button) {
            button.textContent = theme === "dark" ? "Modo claro" : "Modo oscuro";
            button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
        }
    }

    function currentImportSnapshot() {
        try {
            const value = localStorage.getItem("novaris:last-import");
            return value ? JSON.parse(value) : null;
        } catch (error) {
            return null;
        }
    }

    function buildAssistantReply(message) {
        const text = String(message || "").toLowerCase();
        const isAdmin = document.querySelector(".sidebar-nav[data-admin-nav='true']");
        if (isAdmin) {
            const users = readLocalUsersForAssistant();
            const companies = users.filter((user) => user?.email && user.role !== "admin");
            const mrr = companies.reduce((sum, company) => {
                const plan = String(company.subscription_plan || "growth").toLowerCase();
                const prices = { starter: 49, growth: 99, business: 199, enterprise: 499 };
                return sum + (prices[plan] || prices.growth);
            }, 0);
            if (!message.trim()) return "Escribe una consulta sobre empresas, suscripciones, MRR, ARR, churn o pagos pendientes.";
            if (text.includes("mrr") || text.includes("ingreso")) return `MRR estimado: S/ ${mrr}. ARR estimado: S/ ${mrr * 12}.`;
            if (text.includes("empresa") || text.includes("suscripcion")) return `Empresas registradas: ${companies.length}. Suscripciones activas estimadas: ${companies.filter((item) => item.subscription_status !== "Suspendido").length}.`;
            if (text.includes("churn") || text.includes("riesgo")) return "Riesgo SaaS: revisa empresas con pagos pendientes, planes Starter sin actividad y suscripciones por vencer.";
            if (text.includes("plan")) return "El plan mas rentable suele ser Enterprise por mayor MRR por empresa; valida su adopcion y conversion desde Business.";
            return `Resumen SaaS: ${companies.length} empresas registradas, MRR S/ ${mrr}, ARR S/ ${mrr * 12}. Prioriza cobranza, upgrades y retencion.`;
        }
        const snapshot = typeof getImportSnapshot === "function" ? getImportSnapshot() : currentImportSnapshot();
        const prediction = snapshot?.prediction;
        const totals = snapshot?.profile?.totals || {};
        const columns = snapshot?.columns || [];

        if (!message.trim()) return "Escribe una consulta sobre inventario, stock, demanda o prediccion.";
        if (!snapshot) return "Aun no hay datos importados. Sube un CSV o Excel en Prediccion para que pueda analizar inventario, demanda y alertas.";
        if (text.includes("stock") || text.includes("inventario")) {
            return `Stock total estimado: ${Math.round(Number(totals.stock || prediction?.predicted_stock || 0))}. Alertas por stock bajo: ${Math.round(Number(totals.low_stock || 0))}.`;
        }
        if (text.includes("demanda") || text.includes("venta") || text.includes("salida")) {
            return `Demanda pronosticada: ${Math.round(Number(prediction?.predicted_demand || totals.outgoing || 0))}. Salidas detectadas: ${Math.round(Number(totals.outgoing || 0))}.`;
        }
        if (text.includes("columna") || text.includes("variable")) {
            return `Columnas detectadas: ${columns.slice(0, 8).join(", ") || "sin columnas"}. La prediccion cruza variables numericas para comparar comportamiento.`;
        }
        if (text.includes("alerta") || text.includes("riesgo")) {
            return `Riesgo actual: ${prediction?.classification || "sin clasificacion"}. Revisa primero los productos con stock bajo o demanda en subida.`;
        }
        return `Resumen: ${snapshot.imported_rows || 0} filas importadas, ${columns.length} columnas, stock predicho ${Math.round(Number(prediction?.predicted_stock || 0))} y demanda predicha ${Math.round(Number(prediction?.predicted_demand || 0))}.`;
    }

    function readLocalUsersForAssistant() {
        try {
            return JSON.parse(localStorage.getItem("local_users") || "[]");
        } catch (error) {
            return [];
        }
    }

    function readCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem("user_data") || "null");
        } catch (error) {
            return null;
        }
    }

    function userDisplayName(user) {
        const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
        return String(
            user?.company_name ||
            user?.companyName ||
            user?.business_name ||
            user?.empresa ||
            user?.nombre ||
            user?.name ||
            fullName ||
            user?.email ||
            "Cliente"
        ).trim() || "Cliente";
    }

    function userInitials(name) {
        const clean = String(name || "Cliente").trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        if (!parts.length) return "CL";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }

    function profileValue(value, fallback = "-") {
        const normalized = String(value || "").trim();
        return normalized || fallback;
    }

    function appendProfileDetail(grid, label, value) {
        const item = document.createElement("div");
        item.className = "profile-detail-item";

        const caption = document.createElement("span");
        caption.textContent = label;

        const data = document.createElement("strong");
        data.textContent = profileValue(value);

        item.append(caption, data);
        grid.appendChild(item);
    }

    function closeProfileModal() {
        const modal = document.getElementById("user-profile-modal");
        if (!modal) return;
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
    }

    function ensureProfileModal() {
        let modal = document.getElementById("user-profile-modal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "user-profile-modal";
        modal.className = "profile-view-modal hidden";
        modal.setAttribute("aria-hidden", "true");

        const card = document.createElement("section");
        card.className = "profile-view-card";
        card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");
        card.setAttribute("aria-labelledby", "user-profile-modal-title");

        const header = document.createElement("div");
        header.className = "profile-view-header";

        const headingWrap = document.createElement("div");
        const eyebrow = document.createElement("span");
        eyebrow.className = "profile-view-eyebrow";
        eyebrow.textContent = "Cuenta";

        const title = document.createElement("h2");
        title.id = "user-profile-modal-title";

        headingWrap.append(eyebrow, title);

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "profile-view-close";
        closeButton.setAttribute("aria-label", "Cerrar");
        closeButton.textContent = "x";
        closeButton.addEventListener("click", closeProfileModal);

        header.append(headingWrap, closeButton);

        const body = document.createElement("div");
        body.className = "profile-view-body";

        card.append(header, body);
        modal.appendChild(card);
        document.body.appendChild(modal);

        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeProfileModal();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeProfileModal();
        });

        return modal;
    }

    function buildProfileSummary(user, displayName) {
        const summary = document.createElement("div");
        summary.className = "profile-view-summary";

        const avatar = document.createElement("span");
        avatar.className = "profile-view-avatar";
        avatar.textContent = userInitials(displayName);

        const text = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = displayName;
        const email = document.createElement("span");
        email.textContent = profileValue(user?.email, "Sin correo registrado");
        text.append(name, email);

        summary.append(avatar, text);
        return summary;
    }

    function openProfileModal(action) {
        const modal = ensureProfileModal();
        const user = readCurrentUser() || {};
        const displayName = userDisplayName(user);
        const title = modal.querySelector("#user-profile-modal-title");
        const body = modal.querySelector(".profile-view-body");
        body.innerHTML = "";

        if (action === "profile") {
            title.textContent = "Mi perfil";
            const grid = document.createElement("div");
            grid.className = "profile-detail-grid";
            appendProfileDetail(grid, "Nombre", displayName);
            appendProfileDetail(grid, "Correo", user.email);
            appendProfileDetail(grid, "Rol", user.role || user.tipo_usuario || "Cliente");
            appendProfileDetail(grid, "Telefono", user.phone || user.telefono);
            appendProfileDetail(grid, "Estado", user.status || user.subscription_status || "Activo");
            appendProfileDetail(grid, "Documento", user.document || user.documento || user.ruc || user.dni);
            body.append(buildProfileSummary(user, displayName), grid);
        } else if (action === "settings") {
            title.textContent = "Configuracion";

            const settings = document.createElement("div");
            settings.className = "profile-settings";

            const themeGroup = document.createElement("label");
            themeGroup.className = "profile-setting-field";
            const themeLabel = document.createElement("span");
            themeLabel.textContent = "Tema de la interfaz";
            const themeSelect = document.createElement("select");
            themeSelect.innerHTML = `
                <option value="light">Modo claro</option>
                <option value="dark">Modo oscuro</option>
            `;
            themeSelect.value = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
            themeGroup.append(themeLabel, themeSelect);

            const saveButton = document.createElement("button");
            saveButton.type = "button";
            saveButton.className = "btn btn-primary";
            saveButton.textContent = "Guardar configuracion";

            const feedback = document.createElement("p");
            feedback.className = "profile-settings-feedback";
            feedback.setAttribute("aria-live", "polite");

            saveButton.addEventListener("click", () => {
                applyTheme(themeSelect.value);
                feedback.textContent = "Configuracion guardada.";
            });

            settings.append(themeGroup, saveButton, feedback);
            body.appendChild(settings);
        } else if (action === "company") {
            title.textContent = "Mi empresa";
            const grid = document.createElement("div");
            grid.className = "profile-detail-grid";
            appendProfileDetail(grid, "Empresa", user.company_name || user.companyName || user.business_name || user.empresa || displayName);
            appendProfileDetail(grid, "RUC", user.ruc || user.tax_id || user.documento);
            appendProfileDetail(grid, "Correo", user.company_email || user.email);
            appendProfileDetail(grid, "Telefono", user.company_phone || user.phone || user.telefono);
            appendProfileDetail(grid, "Plan", user.subscription_plan || user.plan || "Growth");
            appendProfileDetail(grid, "Suscripcion", user.subscription_status || user.status || "Activa");
            body.append(buildProfileSummary(user, displayName), grid);
        }

        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        modal.querySelector(".profile-view-close")?.focus();
    }

    function closeProfileMenus(except = null) {
        document.querySelectorAll(".user-profile").forEach((profile) => {
            if (profile === except) return;
            profile.classList.remove("is-open");
            profile.querySelector(".user-profile-button")?.setAttribute("aria-expanded", "false");
        });
    }

    function renderUserProfileMenu() {
        const topbarActions = document.querySelector(".topbar-actions");
        if (!topbarActions || document.querySelector(".user-profile")) return;
        if (!localStorage.getItem("token")) return;

        const user = readCurrentUser();
        const displayName = userDisplayName(user);
        const initials = userInitials(displayName);

        const wrapper = document.createElement("div");
        wrapper.className = "user-profile";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "user-profile-button";
        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");

        const avatar = document.createElement("span");
        avatar.className = "user-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = initials;

        const name = document.createElement("span");
        name.className = "user-profile-name";
        name.textContent = displayName;

        const chevron = document.createElement("span");
        chevron.className = "user-profile-chevron";
        chevron.setAttribute("aria-hidden", "true");
        chevron.textContent = "⌄";

        button.append(avatar, name, chevron);

        const dropdown = document.createElement("div");
        dropdown.className = "user-profile-dropdown";
        dropdown.setAttribute("role", "menu");
        [
            ["profile", "Mi perfil"],
            ["settings", "Configuracion"],
            ["company", "Mi empresa"],
            ["logout", "Cerrar sesion"],
        ].forEach(([action, label]) => {
            const item = document.createElement("button");
            item.type = "button";
            item.setAttribute("role", "menuitem");
            item.dataset.profileAction = action;
            item.textContent = label;
            dropdown.appendChild(item);
        });
        wrapper.append(button, dropdown);

        button.addEventListener("click", (event) => {
            event.stopPropagation();
            const nextOpen = !wrapper.classList.contains("is-open");
            closeProfileMenus(wrapper);
            wrapper.classList.toggle("is-open", nextOpen);
            button.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        });
        dropdown.addEventListener("click", (event) => {
            const action = event.target.closest("[data-profile-action]")?.dataset.profileAction;
            if (!action) return;
            closeProfileMenus();
            if (action === "logout") {
                if (typeof window.logout === "function") {
                    window.logout();
                } else {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user_data");
                    window.location.href = "/login.html";
                }
                return;
            }
            openProfileModal(action);
        });

        topbarActions.appendChild(wrapper);
    }

    function appendAssistantMessage(body, role, text) {
        const item = document.createElement("div");
        item.className = `assistant-message ${role}`;
        item.textContent = text;
        body.appendChild(item);
        body.scrollTop = body.scrollHeight;
    }

    function renderAssistant() {
        if (document.querySelector(".assistant-widget")) return;
        const isAdmin = document.querySelector(".sidebar-nav[data-admin-nav='true']");

        const topbarActions = document.querySelector(".topbar-actions");
        if (topbarActions) {
            const themeButton = document.createElement("button");
            themeButton.id = "theme-toggle";
            themeButton.type = "button";
            themeButton.className = "btn btn-secondary theme-toggle";
            themeButton.addEventListener("click", () => {
                const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
                applyTheme(next);
            });

            const assistantButton = document.createElement("button");
            assistantButton.type = "button";
            assistantButton.className = "btn btn-primary assistant-open";
            assistantButton.textContent = "Asistente IA";
            assistantButton.addEventListener("click", () => {
                document.querySelector(".assistant-widget")?.classList.toggle("is-open");
            });

            topbarActions.prepend(assistantButton);
            topbarActions.prepend(themeButton);
        }

        const widget = document.createElement("section");
        widget.className = "assistant-widget";
        widget.setAttribute("aria-label", "Asistente IA");
        widget.innerHTML = `
            <div class="assistant-panel">
                <div class="assistant-header">
                    <div>
                        <strong>Asistente IA</strong>
                        <span>${isAdmin ? "Analisis SaaS" : "Inventario y prediccion"}</span>
                    </div>
                    <button type="button" class="assistant-close" aria-label="Cerrar asistente">x</button>
                </div>
                <div class="assistant-body"></div>
                <form class="assistant-form">
                    <input type="text" name="message" placeholder="${isAdmin ? "Pregunta por MRR, churn o suscripciones..." : "Pregunta por stock, demanda o columnas..."}" autocomplete="off" />
                    <button type="submit" class="btn btn-primary">Enviar</button>
                </form>
            </div>
        `;
        document.body.appendChild(widget);

        const body = widget.querySelector(".assistant-body");
        appendAssistantMessage(body, "bot", isAdmin
            ? "Hola. Puedo analizar empresas, suscripciones, MRR, ARR, churn, pagos pendientes y crecimiento SaaS."
            : "Hola. Puedo resumir tu inventario, revisar demanda y explicar las predicciones importadas.");
        widget.querySelector(".assistant-close").addEventListener("click", () => widget.classList.remove("is-open"));
        widget.querySelector(".assistant-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.message;
            const message = input.value.trim();
            if (!message) return;
            appendAssistantMessage(body, "user", message);
            appendAssistantMessage(body, "bot", buildAssistantReply(message));
            input.value = "";
        });
    }

    function setupResponsiveSidebar() {
        const sidebar = document.querySelector(".sidebar");
        const topbar = document.querySelector(".topbar");
        if (!sidebar || !topbar || document.querySelector(".mobile-sidebar-toggle")) return;

        sidebar.id = sidebar.id || "app-sidebar";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "mobile-sidebar-toggle";
        button.setAttribute("aria-controls", sidebar.id);
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Abrir menu");
        button.innerHTML = "<span></span><span></span><span></span>";

        const backdrop = document.createElement("div");
        backdrop.className = "sidebar-backdrop";
        backdrop.hidden = true;

        topbar.prepend(button);
        document.body.appendChild(backdrop);

        const setOpen = (open) => {
            document.body.classList.toggle("sidebar-open", open);
            button.setAttribute("aria-expanded", open ? "true" : "false");
            button.setAttribute("aria-label", open ? "Cerrar menu" : "Abrir menu");
            backdrop.hidden = !open;
        };

        button.addEventListener("click", () => setOpen(!document.body.classList.contains("sidebar-open")));
        backdrop.addEventListener("click", () => setOpen(false));
        sidebar.addEventListener("click", (event) => {
            if (event.target.closest("a, button")) setOpen(false);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setOpen(false);
        });
        window.addEventListener("resize", () => {
            if (window.innerWidth >= 1024) setOpen(false);
        });
    }

    function renderNav() {
        const nav = document.querySelector(".sidebar-nav");
        if (!nav) return;

        const current = normalize(window.location.pathname) || "dashboard.html";
        const currentHash = window.location.hash || "#dashboard-summary";
        nav.innerHTML = "";
        let currentUser = null;
        try {
            currentUser = JSON.parse(localStorage.getItem("user_data") || "null");
        } catch (error) {
            currentUser = null;
        }

        const sourceItems = nav.dataset.adminNav === "true" ? adminItems : items;
        sourceItems.forEach((item) => {
            if (item.adminOnly && currentUser?.role !== "admin") return;
                const li = document.createElement("li");
                const link = document.createElement("a");
                link.href = item.href.startsWith("#") ? item.href : buildHref(item.href);
                // provide richer label + optional description for important items
                const label = document.createElement('div');
                label.className = 'nav-label';
                label.textContent = item.label;
                link.appendChild(label);
            const itemHash = item.href.startsWith("#") ? item.href : `#${normalize(item.href).replace(/\.html$/, "")}`;
            if (item.href.startsWith("#") && itemHash === currentHash) link.className = "active";
            else if (!item.href.startsWith("#") && normalize(item.href) === current) link.className = "active";
            li.appendChild(link);
            nav.appendChild(li);
        });

        // ensure active state is kept in sync with current hash/path
        function updateActive() {
            const links = nav.querySelectorAll('a');
            const current = normalize(window.location.pathname) || "dashboard.html";
            const currentHash = window.location.hash || "#dashboard-summary";
            links.forEach((lnk) => {
                lnk.classList.remove('active');
                const href = lnk.getAttribute('href') || '';
                if (href.startsWith('#') && href === currentHash) lnk.classList.add('active');
                else if (!href.startsWith('#') && normalize(href) === current) lnk.classList.add('active');
            });
        }

        updateActive();
        window.addEventListener('hashchange', updateActive);

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

    const storedTheme = localStorage.getItem(THEME_KEY) || "light";
    document.documentElement.dataset.theme = storedTheme;

    document.addEventListener("DOMContentLoaded", () => {
        renderNav();
        setupResponsiveSidebar();
        renderAssistant();
        renderUserProfileMenu();
        applyTheme(localStorage.getItem(THEME_KEY) || "light");
        document.addEventListener("click", () => closeProfileMenus());
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeProfileMenus();
        });
    });
})();
