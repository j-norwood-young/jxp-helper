export class JXPError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly url: string;
  readonly method: string;

  constructor(options: {
    status: number;
    statusText: string;
    body: unknown;
    url: string;
    method: string;
  }) {
    super(`JXP request failed with ${options.status} ${options.statusText}`);
    this.name = 'JXPError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.body = options.body;
    this.url = options.url;
    this.method = options.method;
  }
}
