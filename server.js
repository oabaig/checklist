const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 4321;
const INDEX_HTML_PATH = path.join(__dirname, "public", "index.html");

// Checklist data is stored in the browser's localStorage, so the server only serves the page.
const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (request.method === "GET" && requestPath === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(INDEX_HTML_PATH).pipe(response);
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Checklist app running at http://localhost:${PORT}`);
});
