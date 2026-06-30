const isLocalHost = ["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:";
const API_BASE = isLocalHost
    ? "http://localhost:8000/api/v1"
    : "https://biblioapp-api.onrender.com/api/v1";
const API_FALLBACK_BASE = isLocalHost ? "http://127.0.0.1:8000/api/v1" : API_BASE;

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };
    const fetchWithTimeout = async (baseUrl) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        try {
            return await fetch(`${baseUrl}${endpoint}`, { ...options, headers, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    };

    let res;
    try {
        res = await fetchWithTimeout(API_BASE);
    } catch (error) {
        if (API_FALLBACK_BASE !== API_BASE) {
            try {
                res = await fetchWithTimeout(API_FALLBACK_BASE);
            } catch (fallbackError) {
                const networkError = new Error("No se pudo conectar con el backend local.");
                networkError.isNetworkError = true;
                throw networkError;
            }
        } else {
            const networkError = new Error("No se pudo conectar con el backend local.");
            networkError.isNetworkError = true;
            throw networkError;
        }
    }

    if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user_data");
        window.location.href = "/login.html";
        return;
    }

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Error en la solicitud");
    }

    return res.status === 204 ? null : res.json();
}
