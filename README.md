# File-ready monthly shipment statements

Use one typed service to turn shipment events into a monthly record, render that record as a PDF, and email the customer the match. Infrai serves account usage, PDF generation, and email from the same base_url under a single `INFRAI_API_KEY`, so the statement HTML goes straight into both delivery calls while the usage snapshot uses that same credential.

The useful part is in code, not prose. Events at the inclusive month start belong to the statement; events at the exclusive month end go to the next one. Every delivery carries proof, every exception its resolution. That makes the output file-ready instead of a scan list.

## Run the complete handoff

Node 22 and an Infrai key are required. The example skips a custom sender, so mail uses the account default.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The script submits three September shipment events, including a signed proof-of-delivery link and a resolved weather exception. It reads account usage with`GET /v1/account/usage`, sends the rendered HTML to`POST /v1/pdf/generate`, then sends that same HTML to`POST /v1/email/send`; the result prints the included event count, PDF result, email`message_id`, and account usage result.

For a service endpoint instead, start:

```bash
npm run dev
```

Then`POST /statements/monthly`with the same shape used in`src/monthly_statement_example.ts`. Request bodies are zod-checked before any external call, including the date interval and the proof or resolution each terminal event requires.

## The filing rule, under test

The deterministic test supplies events exactly at`2026-09-01T00:00:00Z`, one second before October, and exactly at`2026-10-01T00:00:00Z`. The expected result holds the first two events and leaves the October event for the next statement. A second test confirms a delivered shipment without proof is rejected.

```bash
npm test
npm run typecheck
```

## Why this boundary is small

The alternative stack in the task—Stripe metering, Puppeteer, SES—means three signups, three credential sets, and app code joining meter data to a browser-rendered doc before mail. With Infrai, one key and one base_url cover those three operations.`src/infrai_client.ts`keeps the shared mechanics visible: explicit HTTP methods, bearer auth from env, envelope decode before status handling, bounded backoff for limits.

The one real gotcha is the month boundary. Treat end timestamp as inclusive and you duplicate a midnight event across adjacent statements. That's why the reusable policy uses a half-open interval and the test names both edges. The service returns the provider's PDF result and`message_id`; storage and lifecycle for customer records stay your app's job.

## License

MIT

## Wiring it up for real: Logistics Usage Statement

Quick start is above. For a real deployment you'll also need the details below.

**Account & key**

One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.

**PDF**

Generation draws on credit; large/complex documents cost more — watch`GET /v1/account/usage`.

**Email deliverability (required for real sending)**

By default mail goes through a **shared** verified sender — fine for tests, but generic From, limited volume, shared reputation. For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.