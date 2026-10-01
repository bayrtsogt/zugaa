// Minimal mock of the Telegram Bot API for local end-to-end tests.
// Records every call; GET /calls returns them, DELETE /calls clears.
import { createServer } from "node:http";

const calls = [];
let nextMessageId = 1000;

createServer(async (req, res) => {
  if (req.url === "/calls") {
    if (req.method === "DELETE") calls.length = 0;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify(calls));
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const method = req.url.split("/").pop();
  const params = body ? JSON.parse(body) : {};
  calls.push({ method, params });
  let result = true;
  if (method === "sendMessage") {
    result = { message_id: nextMessageId++, chat: { id: Number(params.chat_id) }, text: params.text };
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, result }));
}).listen(Number(process.env.PORT ?? 8099), () => console.log("mock telegram on", process.env.PORT ?? 8099));
