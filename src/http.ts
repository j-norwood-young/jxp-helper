import { JXPError } from './errors';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Convenience: builds AbortSignal.timeout(ms) when `signal` is not set. */
  timeoutMs?: number;
}

export async function jxpRequest<T>(
  url: string,
  apiKey: string | undefined,
  bearerToken: string | undefined,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Prefer bearer access tokens when both are present (post-login session).
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  else if (apiKey) headers['X-API-Key'] = apiKey;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const signal =
    options.signal ??
    AbortSignal.timeout(
      typeof options.timeoutMs === 'number' && options.timeoutMs > 0
        ? options.timeoutMs
        : 30_000
    );

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal
  });

  const contentType = response.headers.get('content-type') ?? '';
  const result = contentType.includes('json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new JXPError({
      status: response.status,
      statusText: response.statusText,
      body: result,
      url,
      method: options.method ?? 'GET'
    });
  }

  return result as T;
}
