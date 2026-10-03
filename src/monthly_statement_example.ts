import { clientFromEnvironment } from "./infrai_client.js";
import { statementRequestSchema } from "./statement_policy.js";
import { sendMonthlyStatement } from "./statement_sender.js";

const statement = statementRequestSchema.parse({
  customer: { name: "North Harbor Foods", email: "operations@example.com" },
  period: { start: "2026-09-01", end: "2026-10-01" },
  events: [
    {
      shipment_id: "SHP-2048",
      occurred_at: "2026-09-03T09:14:00Z",
      kind: "picked_up",
      description: "Pallet collected at Shanghai depot",
    },
    {
      shipment_id: "SHP-2048",
      occurred_at: "2026-09-05T16:40:00Z",
      kind: "delivered",
      description: "Received at customer dock",
      proof_of_delivery: { name: "signed-pod-SHP-2048.pdf", url: "https://files.example.com/pod/SHP-2048" },
    },
    {
      shipment_id: "SHP-2071",
      occurred_at: "2026-09-18T04:20:00Z",
      kind: "exception",
      description: "Weather delay recorded",
      exception: { code: "WEATHER_DELAY", resolution: "Routed through Ningbo; delivered next day" },
    },
  ],
});

const receipt = await sendMonthlyStatement(clientFromEnvironment(), statement);
console.log(JSON.stringify(receipt, null, 2));
