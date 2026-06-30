function isLoggedIn() {
    return !!localStorage.getItem("token");
}

function getUserData() {
    const data = localStorage.getItem("user_data");
    return data ? JSON.parse(data) : null;
}

function isAdmin() {
    const userData = getUserData();
    return userData && (userData.role === "admin" || userData.role === "cliente_admin");
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

function localRegister(nombre, email, password, companyName = "", ruc = "", phone = "") {
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
        role: companyName || ruc ? "cliente_admin" : "lector",
        company_name: companyName,
        ruc,
        phone,
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
        email,
        role: response.role,
        local: false,
    });

    return response;
}

async function register(nombre, email, password, companyName = "", ruc = "", phone = "") {
    const profile = {
        nombre,
        email,
        role: companyName || ruc ? "cliente_admin" : "lector",
        company_name: companyName,
        ruc,
        phone,
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
        return localRegister(nombre, email, password, companyName, ruc, phone);
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
            window.location.href = "/dashboard.html";
        } catch (error) {
            alert("Error: " + error.message);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Ingresar";
            }
        }
    });
}

if (document.querySelector("#register-form")) {
    document.querySelector("#register-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const nombre = document.getElementById("nombre").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const companyName = document.getElementById("company_name")?.value || "";
        const ruc = document.getElementById("ruc")?.value || "";
        const phone = document.getElementById("phone")?.value || "";

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Creando cuenta...";
            }
            const response = await register(nombre, email, password, companyName, ruc, phone);
            alert(response.local ? "Cuenta creada localmente. Inicia sesion con esos datos." : "Cuenta creada exitosamente. Inicia sesion ahora.");
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
