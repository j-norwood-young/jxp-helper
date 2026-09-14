import { JXPError } from './errors';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function jxpRequest<T>(
  url: string,
  apiKey: string | undefined,
  bearerToken: string | undefined,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  if (!apiKey && bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal ?? AbortSignal.timeout(30_000)
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
