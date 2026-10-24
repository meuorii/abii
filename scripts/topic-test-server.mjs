// Run Next in one owned process so the HTTP test can stop it on Windows too.
import next from "next";
import { createServer } from "node:http";

const port = Number(process.argv[2]);
const app = next({ dev: true, hostname: "127.0.0.1", port });
await app.prepare();
const handler = app.getRequestHandler();
createServer((request, response) => handler(request, response)).listen(port, "127.0.0.1", () => console.log("Ready in test server"));
