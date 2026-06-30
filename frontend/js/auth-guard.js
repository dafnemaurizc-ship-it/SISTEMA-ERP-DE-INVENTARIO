(function () {
    const publicFiles = ["login.html", "register.html", ""];

    try {
        const path = window.location.pathname || "";
        const file = path.substring(path.lastIndexOf("/") + 1);
        if (publicFiles.includes(file)) return;

        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login.html";
        }
    } catch (error) {
        console.error("auth-guard error", error);
    }
})();
