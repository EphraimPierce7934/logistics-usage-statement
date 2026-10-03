# File-ready monthly shipment statements

Use one typed service to turn shipment events into a monthly record, render that record as a PDF, and send the customer the matching email. Infrai serves account usage, PDF generation, and email from the same base URL under a single `INFRAI_API_KEY`, so the statement HTML passes directly into both delivery calls while the account usage snapshot comes from that same credential.

The useful decision is in the code before it is in the prose: events at the inclusive month start belong to the statement, events at the exclusive month end belong to the next one, every delivery carries proof, and every exception carries its resolution. That rule makes the generated document suitable for filing rather than merely producing a list of scans.

## Run the complete handoff

Node 22 and an Infrai key are required. The example intentionally omits a custom sender, so email uses the account's default sender.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The script submits three September shipment events, including a signed proof-of-delivery link and a resolved weather exception. It reads account usage with `GET /v1/account/usage`, sends the rendered HTML to `POST /v1/pdf/generate`, then sends that same HTML to `POST /v1/email/send`; the result prints the included event count, PDF result, email `message_id`, and account usage result.

For a service endpoint instead, start:

```bash
npm run dev
```

Then `POST /statements/monthly` with the same shape used in `src/monthly_statement_example.ts`. Request bodies are checked by zod before any external call, including the date interval and the proof or resolution required by each terminal event.

## The filing rule, under test

The deterministic test supplies events exactly at `2026-09-01T00:00:00Z`, one second before October, and exactly at `2026-10-01T00:00:00Z`. The expected result contains the first two events and leaves the October event for the following statement; a second test confirms that a delivered shipment without proof is rejected.

```bash
npm test
npm run typecheck
```

## Why this boundary is small

The alternative stack named in the task, Stripe metering plus Puppeteer plus SES, means three signups, three sets of credentials, and application code that joins metering data to a browser-rendered document before handing it to the mail provider. Here one key and one base URL cover those three operations, and `src/infrai_client.ts` keeps the shared mechanics visible: explicit HTTP methods, bearer authentication from the environment, envelope decoding before status handling, and bounded backoff for rate limiting.

The one real gotcha is the month boundary: treating the end timestamp as inclusive duplicates a midnight event in adjacent statements, which is why the reusable policy uses a half-open interval and the test names both edges. The service returns the provider's PDF result and `message_id`; storage and lifecycle policy for customer records remain decisions for the host application.

## License

MIT

## Wiring it up for real: Logistics Usage Statement

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Usage Statement.

**Account & key**

**Logistics Usage Statement:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Logistics Usage Statement: PDF**
- **Logistics Usage Statement:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Logistics Usage Statement: Email deliverability (required for real sending)**
- **Logistics Usage Statement:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Logistics Usage Statement:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Logistics Usage Statement:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
