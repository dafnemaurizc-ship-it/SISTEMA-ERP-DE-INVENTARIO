const ADMIN_PLANS = {
    starter: { name: "Starter", price: 49, seats: 3, support: "Basico", color: "#38bdf8" },
    growth: { name: "Growth", price: 99, seats: 10, support: "Estandar", color: "#2563eb" },
    business: { name: "Business", price: 199, seats: 35, support: "Prioritario", color: "#7c3aed" },
    enterprise: { name: "Enterprise", price: 499, seats: 120, support: "Dedicado", color: "#f59e0b" },
};

function adminReadJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

function adminMoney(value) {
    return `S/ ${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
}

function adminNumber(value) {
    return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function adminEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function adminPlanKey(value) {
    const key = String(value || "growth").toLowerCase();
    return ADMIN_PLANS[key] ? key : "growth";
}

function adminPlanFor(company) {
    return ADMIN_PLANS[adminPlanKey(company.plan)];
}

function adminCompanyRows() {
    const users = adminReadJson("local_users", []);
    const profiles = Object.values(adminReadJson("saved_profiles", {}));
    const byEmail = new Map();

    [...users, ...profiles].forEach((user) => {
        if (!user?.email || user.role === "admin") return;
        const plan = adminPlanKey(user.subscription_plan);
        byEmail.set(String(user.email).toLowerCase(), {
            empresa: user.company_name || user.companyName || user.business_name || user.nombre || user.email,
            responsable: user.nombre || "Administrador",
            email: user.email,
            ruc: user.ruc || "-",
            plan,
            estado: user.subscription_status || (user.activo === false ? "Suspendida" : "Activa"),
            usuarios: Number(user.users || user.team_size || ADMIN_PLANS[plan].seats),
            created_at: user.created_at || user.updated_at || new Date().toISOString(),
        });
    });

    return [...byEmail.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function adminMetrics(companies) {
    const now = new Date();
    const activeCompanies = companies.filter((company) => company.estado !== "Suspendida" && company.estado !== "Cancelada");
    const newThisMonth = companies.filter((company) => {
        const created = new Date(company.created_at);
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    });
    const mrr = activeCompanies.reduce((sum, company) => sum + adminPlanFor(company).price, 0);
    const pendingPayments = adminPendingPayments(companies);
    const churnCount = companies.filter((company) => company.estado === "Suspendida" || company.estado === "Cancelada").length;
    const churn = companies.length ? (churnCount / companies.length) * 100 : 0;

    return {
        totalCompanies: companies.length,
        activeCompanies: activeCompanies.length,
        newThisMonth: newThisMonth.length,
        totalUsers: companies.reduce((sum, company) => sum + company.usuarios, 0),
        activeSubscriptions: activeCompanies.length,
        mrr,
        arr: mrr * 12,
        monthIncome: Math.max(0, mrr - pendingPayments.reduce((sum, payment) => sum + payment.amount, 0)),
        pendingPayments,
        churn,
        supportTickets: Math.max(3, Math.ceil(companies.length * 0.18)),
        uptime: "99.98%",
    };
}

function adminPendingPayments(companies) {
    return companies
        .filter((company, index) => company.estado !== "Suspendida" && index % 4 === 1)
        .map((company, index) => {
            const due = new Date();
            due.setDate(due.getDate() + 3 + index * 2);
            return {
                company: company.empresa,
                amount: adminPlanFor(company).price,
                dueDate: due,
                status: index % 2 === 0 ? "Pendiente" : "Por vencer",
            };
        });
}

function adminPlanStats(companies) {
    return companies.reduce((stats, company) => {
        const key = adminPlanKey(company.plan);
        stats[key] = (stats[key] || 0) + 1;
        return stats;
    }, {});
}

function adminSetText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function adminRenderStats(metrics) {
    adminSetText("admin-total-companies", adminNumber(metrics.totalCompanies));
    adminSetText("admin-active-companies", adminNumber(metrics.activeCompanies));
    adminSetText("admin-new-companies", adminNumber(metrics.newThisMonth));
    adminSetText("admin-total-users", adminNumber(metrics.totalUsers));
    adminSetText("admin-active-subscriptions", adminNumber(metrics.activeSubscriptions));
    adminSetText("admin-mrr", adminMoney(metrics.mrr));
    adminSetText("admin-arr", adminMoney(metrics.arr));
    adminSetText("admin-month-income", adminMoney(metrics.monthIncome));
    adminSetText("admin-pending-payments", adminNumber(metrics.pendingPayments.length));
    adminSetText("admin-churn", `${metrics.churn.toFixed(1)}%`);
    adminSetText("admin-support-tickets", adminNumber(metrics.supportTickets));
    adminSetText("admin-uptime", metrics.uptime);
    adminSetText("admin-growth-badge", `${metrics.activeSubscriptions} suscripciones`);
}

function adminMonthSeries(base, modifier = 1) {
    const months = ["Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul"];
    return months.map((month, index) => ({
        month,
        value: Math.max(1, Math.round(base * (0.48 + index * 0.055 + (index % 3) * 0.025) * modifier)),
    }));
}

function adminRenderMrrChart(metrics) {
    const container = document.getElementById("admin-mrr-chart");
    if (!container) return;
    const values = adminMonthSeries(Math.max(metrics.mrr, 1200));
    const max = Math.max(...values.map((item) => item.value), 1);
    container.innerHTML = values.map((item) => `
        <div class="chart-bar" title="${adminEscape(item.month)} ${adminMoney(item.value)}">
            <i style="--height:${Math.max(18, (item.value / max) * 220)}px"></i>
            <span>${adminEscape(item.month)}</span>
        </div>
    `).join("");
}

function adminRenderCompanyFlow(metrics) {
    const container = document.getElementById("admin-company-flow-chart");
    if (!container) return;
    const months = ["Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul"];
    container.innerHTML = months.map((month, index) => {
        const created = Math.max(2, Math.round(metrics.totalCompanies * (0.05 + (index % 4) * 0.012)));
        const canceled = Math.max(1, Math.round(created * (metrics.churn / 100 + 0.18)));
        const max = Math.max(created, canceled, 1);
        return `
            <div class="admin-dual-item">
                <div class="admin-dual-bars">
                    <i class="positive" style="--height:${Math.max(18, (created / max) * 92)}px"></i>
                    <i class="negative" style="--height:${Math.max(10, (canceled / max) * 72)}px"></i>
                </div>
                <span>${month}</span>
            </div>
        `;
    }).join("");
}

function adminRenderPlanDistribution(companies) {
    const container = document.getElementById("admin-plan-distribution");
    if (!container) return;
    const stats = adminPlanStats(companies);
    const total = Math.max(companies.length, 1);
    const entries = Object.entries(ADMIN_PLANS).map(([key, plan]) => ({
        key,
        plan,
        count: stats[key] || 0,
        percent: Math.round(((stats[key] || 0) / total) * 100),
    }));
    container.innerHTML = `
        <div class="admin-donut" style="--a:${entries[0].percent}%;--b:${entries[1].percent}%;--c:${entries[2].percent}%">
            <strong>${adminNumber(companies.length)}</strong>
            <span>Empresas</span>
        </div>
        <div class="admin-donut-legend">
            ${entries.map((item) => `<div><i style="background:${item.plan.color}"></i><span>${item.plan.name}</span><strong>${item.count} (${item.percent}%)</strong></div>`).join("")}
        </div>
    `;
}

function adminRenderPlanRevenue(companies) {
    const container = document.getElementById("admin-plan-revenue");
    if (!container) return;
    const stats = adminPlanStats(companies);
    const revenues = Object.entries(ADMIN_PLANS).map(([key, plan]) => ({
        name: plan.name,
        value: (stats[key] || 0) * plan.price,
        color: plan.color,
    })).sort((a, b) => b.value - a.value);
    const max = Math.max(...revenues.map((item) => item.value), 1);
    container.innerHTML = revenues.map((item) => `
        <div class="admin-plan-revenue-row">
            <div><strong>${adminEscape(item.name)}</strong><span>${adminMoney(item.value)}</span></div>
            <div class="admin-progress"><i style="--value:${Math.max(6, (item.value / max) * 100)}%;background:${item.color}"></i></div>
        </div>
    `).join("");
}

function adminRenderCompactCharts(metrics) {
    const growth = document.getElementById("admin-growth-chart");
    const churn = document.getElementById("admin-churn-chart");
    const growthValues = [4, 6, 5, 9, 11, 8, 12, 15, 14, 17, 16, Math.max(1, Math.round(metrics.mrr / 100))];
    const churnValues = [2.6, 2.1, 2.8, 2.4, 1.9, 2.2, 1.7, 1.5, 1.8, 1.3, 1.1, Math.max(metrics.churn, 0.7)];

    if (growth) growth.innerHTML = growthValues.map((value) => `<i style="--height:${Math.max(16, value * 7)}px"></i>`).join("");
    if (churn) churn.innerHTML = churnValues.map((value) => `<i class="warning" style="--height:${Math.max(16, value * 24)}px"></i>`).join("");
}

function adminRenderCompanies(companies) {
    const container = document.getElementById("admin-companies-table");
    if (!container) return;
    if (!companies.length) {
        container.className = "empty-state";
        container.textContent = "Sin empresas registradas desde login o registro.";
        return;
    }
    container.className = "table-wrap";
    container.innerHTML = `
        <table>
            <thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Fecha de registro</th></tr></thead>
            <tbody>
                ${companies.slice(0, 8).map((company) => `
                    <tr>
                        <td><strong>${adminEscape(company.empresa)}</strong><br><span class="muted">${adminEscape(company.email)}</span></td>
                        <td>${adminEscape(adminPlanFor(company).name)}</td>
                        <td><span class="badge ${company.estado === "Activa" ? "badge-success" : "badge-warning"}">${adminEscape(company.estado)}</span></td>
                        <td>${adminEscape(new Date(company.created_at).toLocaleDateString("es-PE"))}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function adminRenderPendingPayments(metrics) {
    const container = document.getElementById("admin-pending-payments-table");
    if (!container) return;
    if (!metrics.pendingPayments.length) {
        container.className = "empty-state";
        container.textContent = "No hay pagos pendientes.";
        return;
    }
    container.className = "table-wrap";
    container.innerHTML = `
        <table>
            <thead><tr><th>Empresa</th><th>Monto</th><th>Vencimiento</th><th>Estado</th></tr></thead>
            <tbody>
                ${metrics.pendingPayments.map((payment) => `
                    <tr>
                        <td>${adminEscape(payment.company)}</td>
                        <td>${adminMoney(payment.amount)}</td>
                        <td>${adminEscape(payment.dueDate.toLocaleDateString("es-PE"))}</td>
                        <td><span class="badge badge-warning">${adminEscape(payment.status)}</span></td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function adminRenderLists(companies, metrics) {
    const alerts = document.getElementById("admin-important-alerts");
    const activity = document.getElementById("admin-recent-activity");
    const users = document.getElementById("admin-users-list");
    const security = document.getElementById("admin-security-list");

    if (alerts) {
        const riskCompany = companies.find((company) => company.estado !== "Activa")?.empresa || "Empresas Starter sin upgrade";
        alerts.innerHTML = [
            ["Facturas vencidas", `${metrics.pendingPayments.length} pagos requieren seguimiento.`],
            ["Riesgo de cancelacion", `${adminEscape(riskCompany)} en revision comercial.`],
            ["Suscripciones por vencer", "Renovaciones programadas para los proximos 7 dias."],
            ["Fallos del sistema", "Sin incidentes criticos activos."],
            ["Tickets urgentes", `${metrics.supportTickets} tickets abiertos en soporte.`],
        ].map(([title, text]) => `<div class="admin-list-item"><div><strong>${title}</strong><br><span>${text}</span></div><span class="badge badge-info">SaaS</span></div>`).join("");
    }

    if (activity) {
        const first = companies[0]?.empresa || "Nueva empresa";
        activity.innerHTML = [
            ["Nueva empresa registrada", first],
            ["Pago recibido", adminMoney(Math.max(metrics.mrr, 99))],
            ["Plan actualizado", "Growth a Business"],
            ["Usuario creado", companies[0]?.email || "admin@empresa.com"],
            ["Factura emitida", "Factura SaaS mensual"],
        ].map(([title, text]) => `<div class="admin-list-item"><div><strong>${title}</strong><br><span>${adminEscape(text)}</span></div><span class="muted">Hoy</span></div>`).join("");
    }

    if (users) {
        users.innerHTML = [
            ["Usuarios totales", adminNumber(metrics.totalUsers)],
            ["Super administradores", "1"],
            ["Usuarios por empresa", companies.length ? Math.round(metrics.totalUsers / companies.length) : 0],
        ].map(([title, value]) => `<div class="admin-list-item"><strong>${title}</strong><span>${value}</span></div>`).join("");
    }

    if (security) {
        security.innerHTML = [
            ["Disponibilidad", metrics.uptime],
            ["2FA administradores", "Activo"],
            ["Auditoria", "Logs en tiempo real"],
            ["Backups", "Diarios"],
        ].map(([title, value]) => `<div class="admin-list-item"><strong>${title}</strong><span class="badge badge-success">${value}</span></div>`).join("");
    }
}

async function fetchCustomerPredictions() {
    const container = document.getElementById('admin-prediction-table');
    if (!container) return;
    container.className = 'table-wrap';
    container.innerHTML = '<div style="padding:1rem;">Cargando predicciones...</div>';
    try {
        const res = await fetch('/api/v1/erp/predictions/customers');
        if (!res.ok) throw new Error('Error al solicitar predicciones');
        const body = await res.json();
        const rows = body.items || body || [];
        if (!rows.length) {
            container.className = 'empty-state';
            container.textContent = 'No hay datos suficientes para calcular predicciones.';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Empresa</th><th>RUC</th><th>Plan</th><th>Probabilidad Aumento</th><th>Predicción</th></tr></thead>
                <tbody>
                    ${rows.map(r => `
                        <tr>
                            <td>${adminEscape(r.name || r.empresa || r.company || '')}</td>
                            <td>${adminEscape(r.ruc || r.ruc || '')}</td>
                            <td>${adminEscape(r.plan_name || r.plan || '')}</td>
                            <td>${(Number(r.confidence || 0) * 100).toFixed(1)}%</td>
                            <td>${r.will_grow ? 'Aumentará' : 'No aumentará'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.className = 'empty-state';
        container.textContent = 'Error al obtener predicciones.';
        console.error(error);
    }
}

function adminShowSectionFromHash() {
    const summary = document.getElementById('dashboard-summary');
    const detailSections = document.querySelectorAll('.admin-detail-section');
    detailSections.forEach((section) => {
        section.style.display = 'none';
    });
    if (summary) summary.style.display = 'grid';

    const hash = window.location.hash || '#dashboard-summary';
    if (hash === '#dashboard-summary') {
        if (summary) summary.style.display = 'grid';
        return;
    }

    const target = document.querySelector(hash);
    let sectionToShow = null;
    if (target) {
        if (target.classList.contains('admin-detail-section')) {
            sectionToShow = target;
        } else {
            sectionToShow = target.closest('.admin-detail-section');
        }
    }
    if (sectionToShow) {
        sectionToShow.style.display = sectionToShow.classList.contains('admin-chart-grid') ? 'grid' : 'block';
        if (summary) summary.style.display = 'none';
        sectionToShow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const predBtn = document.getElementById('fetch-predictions');
    if (predBtn) predBtn.addEventListener('click', fetchCustomerPredictions);
    adminShowSectionFromHash();
    window.addEventListener('hashchange', () => {
        adminShowSectionFromHash();
        const sec = document.getElementById('prediccion');
        if (!sec) return;
        if (window.location.hash === '#prediccion') sec.style.display = 'block';
        else sec.style.display = 'none';
    });
});

function adminRequireRole() {
    const user = typeof getUserData === "function" ? getUserData() : null;
    if (!user || user.role !== "admin") window.location.replace("/login.html");
}

document.addEventListener("DOMContentLoaded", () => {
    adminRequireRole();
    const companies = adminCompanyRows();
    const metrics = adminMetrics(companies);

    adminRenderStats(metrics);
    adminRenderMrrChart(metrics);
    adminRenderCompanyFlow(metrics);
    adminRenderPlanDistribution(companies);
    adminRenderPlanRevenue(companies);
    adminRenderCompactCharts(metrics);
    adminRenderCompanies(companies);
    adminRenderPendingPayments(metrics);
    adminRenderLists(companies, metrics);
});
