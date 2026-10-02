// Mini-Server für Tests: liefert das Projektverzeichnis statisch aus (Port 8123).
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
module.exports = function serve(port = 8123) {
  return new Promise((res) => {
    const s = http.createServer((req, rs) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); rs.end("nf"); return; }
      rs.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(rs);
    }).listen(port, () => res(s));
  });
};
if (require.main === module) module.exports().then(() => console.log("http://localhost:8123"));
