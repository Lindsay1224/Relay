import { createServer } from "node:http";
import { handleTask } from "./src/worker";

const port = Number(process.env.PORT ?? 8080);
createServer(async (request, response) => {
  if (request.method !== "POST") { response.writeHead(405); response.end(); return; }
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", async () => {
    try { await handleTask(JSON.parse(body)); response.writeHead(204); response.end(); }
    catch { response.writeHead(500); response.end(); }
  });
}).listen(port);
