const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5173);

const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
};

http.createServer((req, res) => {
    let requestPath = decodeURIComponent(req.url.split("?")[0]);
    if (requestPath === "/" || requestPath === "") requestPath = "/login.html";

    const filePath = path.join(root, requestPath);
    if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.stat(filePath, (error, stat) => {
        if (error || !stat.isFile()) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }

        res.writeHead(200, {
            "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        });
        fs.createReadStream(filePath).pipe(res);
    });
}).listen(port, "127.0.0.1", () => {
    console.log(`Novaris frontend: http://127.0.0.1:${port}/login.html`);
});
