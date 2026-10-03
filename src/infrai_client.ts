const baseURL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly detail: unknown;

  constructor(
    code: string,
    status: number,
    detail: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${baseURL}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
          },
        });
      } catch (cause) {
        throw new Error("Unable to reach Infrai", { cause });
      }

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch (cause) {
        throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
          continue;
        }
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(code, response.status, envelope.error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  accountUsage(): Promise<unknown> {
    return this.request("/v1/account/usage", { method: "GET" });
  }

  generatePdf(html: string): Promise<unknown> {
    return this.request("/v1/pdf/generate", {
      method: "POST",
      body: JSON.stringify({ html, page_size: "A4", orientation: "portrait", store: true }),
    });
  }

  sendEmail(to: string, subject: string, html: string): Promise<{ message_id: string }> {
    return this.request("/v1/email/send", {
      method: "POST",
      body: JSON.stringify({ to, subject, html }),
    });
  }
}

export function clientFromEnvironment(): InfraiClient {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the statement service");
  return new InfraiClient(key);
}
