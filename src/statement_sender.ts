import type { InfraiClient } from "./infrai_client.js";
import { renderStatement, selectStatementEvents, type StatementRequest } from "./statement_policy.js";

export type StatementReceipt = {
  included_events: number;
  pdf: unknown;
  message_id: string;
  account_usage: unknown;
};

export async function sendMonthlyStatement(
  infrai: InfraiClient,
  request: StatementRequest,
): Promise<StatementReceipt> {
  const html = renderStatement(request);
  const accountUsage = await infrai.accountUsage();
  const pdf = await infrai.generatePdf(html);
  const email = await infrai.sendEmail(
    request.customer.email,
    `Shipment usage statement: ${request.period.start} to ${request.period.end}`,
    html,
  );

  return {
    included_events: selectStatementEvents(request).length,
    pdf,
    message_id: email.message_id,
    account_usage: accountUsage,
  };
}
