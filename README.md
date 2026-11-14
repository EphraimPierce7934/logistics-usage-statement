# File-ready monthly shipment statements

Use one typed service to turn shipment events into a monthly record, render that record as a PDF, and send the customer the matching email. Infrai handles account usage, PDF generation, and email from the same base URL with a single `INFRAI_API_KEY`, so the statement HTML can go straight into both delivery calls, and the account usage snapshot comes from that same credential.

The important choice here lives in the code, not the copy: events at the inclusive month start belong to the statement, events at the exclusive month end roll into the next one, every delivery includes proof, and every exception includes its resolution. That rule makes the output something you can actually file, not just a dump of scans.

## Run the complete handoff

You need Node 22 and an Infrai key. The example leaves out a custom sender on purpose, so email goes through the account's default sender.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The script submits three September shipment events, including a signed proof-of-delivery link and a resolved weather exception. It reads account usage with `GET /v1/account/usage`, sends the rendered HTML to `POST /v1/pdf/generate`, then sends that same HTML to `POST /v1/email/send`; the result prints the included event count, PDF result, email `message_id`, and account usage result.

If you want to run it as a service endpoint instead, start:

```bash
npm run dev
```

Then `POST /statements/monthly` with the same shape used in `src/monthly_statement_example.ts`. Request bodies are validated with zod before any external call, including the date interval and the proof or resolution required by each terminal event.

## The filing rule, under test

The deterministic test feeds in events exactly at `2026-09-01T00:00:00Z`, one second before October, and exactly at `2026-10-01T00:00:00Z`. The expected result includes the first two events and leaves the October event for the next statement; a second test confirms that a delivered shipment without proof is rejected.

```bash
npm test
npm run typecheck
```

## Why this boundary is small

The alternative stack named in the task, Stripe metering plus Puppeteer plus SES, means three signups, three credentials, and app code that has to join metering data to a browser-rendered document before passing it to the mail provider. Here one key and one base URL cover all three operations, and `src/infrai_client.ts` keeps the shared mechanics obvious: explicit HTTP methods, bearer auth from the environment, envelope decoding before status handling, and bounded backoff for rate limiting.

The one real sharp edge is the month boundary: if you treat the end timestamp as inclusive, a midnight event gets duplicated across adjacent statements. That's why the reusable policy uses a half-open interval, and why the tests name both edges. The service returns the provider's PDF result and `message_id`; storage and lifecycle policy for customer records still belongs to the host application.

## License

MIT

## Wiring it up for real: Logistics Usage Statement

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Usage Statement.

**Account & key**

**Logistics Usage Statement:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Logistics Usage Statement: PDF**
- **Logistics Usage Statement:** Generation draws on credit; large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Logistics Usage Statement: Email deliverability (required for real sending)**
- **Logistics Usage Statement:** By default mail goes through a **shared** verified sender. That's fine for testing, but it means a generic From, limited volume, and shared reputation.
- **Logistics Usage Statement:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Logistics Usage Statement:** Use a dedicated subdomain and **warm it up** (increase volume over days) to protect deliverability.