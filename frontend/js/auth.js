function isLoggedIn() {
    return !!localStorage.getItem("token");
}

function getUserData() {
    const data = localStorage.getItem("user_data");
    return data ? JSON.parse(data) : null;
}

function isAdmin() {
    const userData = getUserData();
    return userData && userData.role === "admin";
}

function getLocalUsers() {
    try {
        return JSON.parse(localStorage.getItem("local_users") || "[]");
    } catch (error) {
        return [];
    }
}

function saveLocalUsers(users) {
    localStorage.setItem("local_users", JSON.stringify(users));
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getSavedProfiles() {
    try {
        return JSON.parse(localStorage.getItem("saved_profiles") || "{}");
    } catch (error) {
        return {};
    }
}

function saveProfile(profile) {
    const email = normalizeEmail(profile.email);
    if (!email) return profile;
    const profiles = getSavedProfiles();
    profiles[email] = {
        ...(profiles[email] || {}),
        ...profile,
        email,
        updated_at: new Date().toISOString(),
    };
    localStorage.setItem("saved_profiles", JSON.stringify(profiles));
    return profiles[email];
}

function getSavedProfile(email) {
    return getSavedProfiles()[normalizeEmail(email)] || null;
}

function setCurrentUserProfile(profile) {
    localStorage.setItem("user_data", JSON.stringify(saveProfile(profile)));
}

function localRegister(nombre, email, password, companyName = "", ruc = "", phone = "", subscriptionPlan = "growth") {
    const users = getLocalUsers();
    const normalizedEmail = normalizeEmail(email);

    if (password.length < 8) {
        throw new Error("La contrasena debe tener minimo 8 caracteres.");
    }

    if (users.some((user) => user.email === normalizedEmail)) {
        throw new Error("Email ya esta registrado localmente.");
    }

    const user = {
        id: Date.now(),
        nombre,
        email: normalizedEmail,
        password,
        role: companyName || ruc ? "company_admin" : "user",
        company_name: companyName,
        ruc,
        phone,
        subscription_plan: subscriptionPlan || "growth",
        subscription_status: "Activo",
        activo: true,
        created_at: new Date().toISOString(),
    };
    users.push(user);
    saveLocalUsers(users);
    saveProfile(user);
    return { ...user, local: true };
}

function localLogin(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = getLocalUsers().find(
        (item) => item.email === normalizedEmail && item.password === password
    );

    if (!user) {
        throw new Error("Credenciales invalidas o backend no disponible.");
    }

    const token = `local-demo-token-${user.id}`;
    localStorage.setItem("token", token);
    setCurrentUserProfile({
        ...user,
        ...(getSavedProfile(user.email) || {}),
        local: true,
    });

    return { access_token: token, token_type: "bearer", role: user.role, local: true };
}

async function login(email, password) {
    let response;
    try {
        response = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    } catch (error) {
        if (!error.isNetworkError) throw error;
        return localLogin(email, password);
    }

    if (!response || !response.access_token) {
        throw new Error("El backend no devolvio un token de acceso valido.");
    }

    localStorage.setItem("token", response.access_token);
    setCurrentUserProfile({
        ...(getSavedProfile(email) || {}),
        ...response,
        email,
        role: response.role,
        local: false,
    });

    return response;
}

function createAdminAccount(name, email, phone, cargo, adminRole, password) {
    const users = getLocalUsers();
    const normalizedEmail = normalizeEmail(email);

    if (!name.trim()) {
        throw new Error("Ingresa el nombre completo del administrador.");
    }
    if (!normalizedEmail) {
        throw new Error("Ingresa el correo del administrador.");
    }
    if (!phone.trim()) {
        throw new Error("Ingresa el teléfono del administrador.");
    }
    if (!cargo.trim()) {
        throw new Error("Ingresa el cargo del administrador.");
    }
    if (!adminRole.trim()) {
        throw new Error("Selecciona un rol administrativo.");
    }
    if (password.length < 8) {
        throw new Error("La contraseña debe tener mínimo 8 caracteres.");
    }

    const existing = users.find((user) => user.email === normalizedEmail);
    if (existing && existing.role !== "admin") {
        throw new Error("Ese correo ya está registrado como cliente.");
    }

    const admin = {
        ...(existing || {}),
        id: existing?.id || Date.now(),
        nombre: name,
        email: normalizedEmail,
        password,
        role: "admin",
        phone,
        cargo,
        admin_role: adminRole,
        activo: true,
        created_at: existing?.created_at || new Date().toISOString(),
    };

    const nextUsers = existing
        ? users.map((user) => user.email === normalizedEmail ? admin : user)
        : [admin, ...users];
    saveLocalUsers(nextUsers);
    saveProfile(admin);
    return admin;
}

function adminLogin(email, password) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        throw new Error("Ingresa el correo del administrador.");
    }
    const user = getLocalUsers().find(
        (item) => item.email === normalizedEmail && item.password === password && item.role === "admin"
    );

    if (!user) {
        throw new Error("No existe un administrador con esas credenciales. Crea el admin primero.");
    }

    const token = `local-admin-token-${user.id}`;
    localStorage.setItem("token", token);
    setCurrentUserProfile({
        ...user,
        ...(getSavedProfile(user.email) || {}),
        local: true,
    });
    return { access_token: token, token_type: "bearer", role: "admin", local: true };
}

async function register(nombre, email, password, companyName = "", ruc = "", phone = "", subscriptionPlan = "growth") {
    const profile = {
        nombre,
        email,
        role: companyName || ruc ? "cliente_admin" : "lector",
        company_name: companyName,
        ruc,
        phone,
        subscription_plan: subscriptionPlan || "growth",
        subscription_status: "Activo",
        activo: true,
    };
    try {
        const response = await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({ nombre, email, password, company_name: companyName, ruc, phone }),
        });
        saveProfile({ ...profile, ...response });
        return response;
    } catch (error) {
        if (!error.isNetworkError) throw error;
        return localRegister(nombre, email, password, companyName, ruc, phone, subscriptionPlan);
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user_data");
    window.location.href = "/login.html";
}

function setupAuthUI() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
}

if (document.querySelector("#login-form")) {
    document.querySelector("#login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Ingresando...";
            }
            await login(email, password);
            const user = getUserData();
            if (user?.role === "admin") {
                window.location.href = "/admin-dashboard.html";
            } else {
                window.location.href = "/dashboard.html";
            }
        } catch (error) {
            alert("Error: " + error.message);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Ingresar";
            }
        }
    });
}

if (document.querySelector("#admin-login-form")) {
    const showAdminLogin = document.getElementById("show-admin-login");
    const backToClientLogin = document.getElementById("back-to-client-login");
    const clientLoginPanel = document.getElementById("client-login-panel");
    const adminLoginPanel = document.getElementById("admin-login-panel");

    showAdminLogin?.addEventListener("click", (event) => {
        event.preventDefault();
        if (clientLoginPanel) clientLoginPanel.classList.add("auth-admin-hidden");
        if (adminLoginPanel) adminLoginPanel.classList.remove("auth-admin-hidden");
    });

    backToClientLogin?.addEventListener("click", (event) => {
        event.preventDefault();
        if (adminLoginPanel) adminLoginPanel.classList.add("auth-admin-hidden");
        if (clientLoginPanel) clientLoginPanel.classList.remove("auth-admin-hidden");
    });

    document.querySelector("#admin-login-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const email = document.getElementById("admin-email").value;
        const password = document.getElementById("admin-password").value;

        try {
            adminLogin(email, password);
            window.location.href = "/admin-dashboard.html";
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

if (document.querySelector("#register-form")) {
    document.querySelector("#register-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const companyName = document.getElementById("company-name").value.trim();
        const companyRuc = document.getElementById("company-ruc").value.trim();
        const subscriptionPlan = document.getElementById("subscription-plan").value;
        const nombre = document.getElementById("nombre").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;

        if (password !== confirmPassword) {
            alert("Error: Las contraseñas no coinciden.");
            return;
        }

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Creando cuenta...";
            }
            await register(nombre, email, password, companyName, companyRuc, phone, subscriptionPlan);
            alert("Cuenta de cliente creada. Inicia sesión con esos datos.");
            window.location.href = "/login.html";
        } catch (error) {
            alert("Error: " + error.message);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Crear cuenta";
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", setupAuthUI);
