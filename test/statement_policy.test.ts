import assert from "node:assert/strict";
import test from "node:test";
import { selectStatementEvents, statementRequestSchema } from "../src/statement_policy.js";

test("the monthly statement includes the start boundary and excludes the end boundary", () => {
  const request = statementRequestSchema.parse({
    customer: { name: "Boundary Freight", email: "records@example.com" },
    period: { start: "2026-09-01", end: "2026-10-01" },
    events: [
      { shipment_id: "S-1", occurred_at: "2026-09-01T00:00:00Z", kind: "picked_up", description: "Collected" },
      { shipment_id: "S-1", occurred_at: "2026-09-30T23:59:59Z", kind: "delivered", description: "Delivered", proof_of_delivery: { name: "pod.pdf", url: "https://records.example.com/pod" } },
      { shipment_id: "S-2", occurred_at: "2026-10-01T00:00:00Z", kind: "exception", description: "Next month", exception: { code: "LATE_SCAN", resolution: "Reviewed" } },
    ],
  });

  assert.deepEqual(selectStatementEvents(request).map((event) => event.shipment_id), ["S-1", "S-1"]);
});

test("a delivered shipment without proof is rejected at the request boundary", () => {
  const result = statementRequestSchema.safeParse({
    customer: { name: "Boundary Freight", email: "records@example.com" },
    period: { start: "2026-09-01", end: "2026-10-01" },
    events: [{ shipment_id: "S-3", occurred_at: "2026-09-10T12:00:00Z", kind: "delivered", description: "Delivered" }],
  });

  assert.equal(result.success, false);
});
