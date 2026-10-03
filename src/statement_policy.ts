import { z } from "zod";

const shipmentEventSchema = z.object({
  shipment_id: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true }),
  kind: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  description: z.string().min(1),
  proof_of_delivery: z
    .object({ name: z.string().min(1), url: z.string().url() })
    .optional(),
  exception: z
    .object({ code: z.string().min(1), resolution: z.string().min(1) })
    .optional(),
});

export const statementRequestSchema = z
  .object({
    customer: z.object({ name: z.string().min(1), email: z.string().email() }),
    period: z.object({ start: z.string().date(), end: z.string().date() }),
    events: z.array(shipmentEventSchema).min(1),
  })
  .superRefine((request, context) => {
    if (request.period.start >= request.period.end) {
      context.addIssue({ code: "custom", path: ["period", "end"], message: "end must follow start" });
    }
    request.events.forEach((event, index) => {
      if (event.kind === "delivered" && !event.proof_of_delivery) {
        context.addIssue({
          code: "custom",
          path: ["events", index, "proof_of_delivery"],
          message: "delivered shipments need proof of delivery",
        });
      }
      if (event.kind === "exception" && !event.exception) {
        context.addIssue({
          code: "custom",
          path: ["events", index, "exception"],
          message: "exception events need a resolution",
        });
      }
    });
  });

export type StatementRequest = z.infer<typeof statementRequestSchema>;

export function selectStatementEvents(request: StatementRequest): StatementRequest["events"] {
  const start = Date.parse(`${request.period.start}T00:00:00Z`);
  const end = Date.parse(`${request.period.end}T00:00:00Z`);
  return request.events
    .filter((event) => {
      const occurredAt = Date.parse(event.occurred_at);
      return occurredAt >= start && occurredAt < end;
    })
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] as string);
}

export function renderStatement(request: StatementRequest): string {
  const events = selectStatementEvents(request);
  const rows = events.map((event) => {
    const evidence = event.proof_of_delivery
      ? `<a href="${escapeHtml(event.proof_of_delivery.url)}">${escapeHtml(event.proof_of_delivery.name)}</a>`
      : event.exception
        ? `${escapeHtml(event.exception.code)}: ${escapeHtml(event.exception.resolution)}`
        : "Recorded";
    return `<tr><td>${escapeHtml(event.occurred_at)}</td><td>${escapeHtml(event.shipment_id)}</td><td>${escapeHtml(event.kind)}</td><td>${escapeHtml(event.description)}</td><td>${evidence}</td></tr>`;
  }).join("\n");

  return `<!doctype html><html><body><h1>Monthly usage statement</h1><p>${escapeHtml(request.customer.name)}</p><p>${request.period.start} to ${request.period.end}</p><p>${events.length} shipment events</p><table><thead><tr><th>Time</th><th>Shipment</th><th>Event</th><th>Detail</th><th>Evidence or resolution</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
