import { createServer } from "node:http";
import { ZodError } from "zod";
import { clientFromEnvironment, InfraiError } from "./infrai_client.js";
import { statementRequestSchema } from "./statement_policy.js";
import { sendMonthlyStatement } from "./statement_sender.js";

const infrai = clientFromEnvironment();
const port = Number(process.env.PORT ?? 3000);

function reply(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/statements/monthly") {
    reply(response, 404, { error: "route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = statementRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    reply(response, 201, await sendMonthlyStatement(infrai, parsed));
  } catch (error) {
    if (error instanceof ZodError) {
      reply(response, 400, { error: "invalid statement", issues: error.issues });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      reply(response, status, { error: error.code });
    } else if (error instanceof SyntaxError) {
      reply(response, 400, { error: "invalid JSON" });
    } else {
      reply(response, 502, { error: "statement delivery failed" });
    }
  }
}).listen(port, () => {
  console.log(`Statement service listening on http://localhost:${port}`);
});
