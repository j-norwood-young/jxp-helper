/**
 * Configuration options for JXPHelper.
 *
 * Provide at least one of `apikey` (X-API-Key) or `token` (Authorization: Bearer).
 * Login / MFA / refresh endpoints can also be called with neither when using the
 * dedicated auth helpers, but authenticated `/api/*` calls require credentials.
 */
export interface JXPHelperOptions {
  /** The server URL */
  server: string;
  /** Long-lived API key sent in the X-API-Key header (machine credentials) */
  apikey?: string;
  /** Ephemeral access token sent as Authorization: Bearer (from /login or /login/mfa) */
  token?: string;
  /** Whether to enable debug mode */
  debug?: boolean;
  /** Whether to hide errors */
  hideErrors?: boolean;
}

/** Successful password / MFA / refresh login payload from JXP. */
export interface TokenPair {
  user_id: string;
  token: string;
  token_expires?: string;
  refresh_token?: string;
  refresh_token_expires?: string;
  provider?: string;
  [key: string]: unknown;
}

/** Password step succeeded but TOTP is required. */
export interface MfaRequiredResponse {
  status: 'mfa_required';
  challenge: string;
  methods: string[];
}

export type LoginStepResult = TokenPair | MfaRequiredResponse;

export function isMfaRequired(result: LoginStepResult): result is MfaRequiredResponse {
  return (result as MfaRequiredResponse)?.status === 'mfa_required';
}

/**
 * @deprecated Prefer TokenPair. Kept for callers that expected LoginData.
 */
export type LoginData = TokenPair;

/**
 * User data structure
 */
export interface UserData {
  _id: string;
  email: string;
  [key: string]: any;
}

/**
 * Login response structure (token pair + hydrated user).
 */
export interface LoginResponse {
  data: TokenPair;
  user: UserData;
}

/**
 * Generic API response structure
 */
export interface ApiResponse<T = any> {
  data: T[];
  count?: number;
  [key: string]: any;
}

/**
 * Bulk write operation for MongoDB
 */
export interface BulkWriteOperation {
  insertOne?: {
    document: any;
  };
  updateOne?: {
    filter: Record<string, any>;
    update: Record<string, any>;
    upsert?: boolean;
  };
  updateMany?: {
    filter: Record<string, any>;
    update: Record<string, any>;
    upsert?: boolean;
  };
  deleteOne?: {
    filter: Record<string, any>;
  };
  deleteMany?: {
    filter: Record<string, any>;
  };
}

/**
 * Query options for API requests.
 * Nested objects expand to bracket keys (e.g. `{ filter: { name: 'a' } }` → `filter[name]=a`).
 * `filters` (plural) is an alias for `filter[...]`. Nullish and empty-string values are omitted.
 */
export type QueryOptionValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | QueryOptionValue[]
  | { [key: string]: QueryOptionValue };

export interface QueryOptions {
  [key: string]: QueryOptionValue;
}

/**
 * Count response structure
 */
export interface CountResponse {
  count: number;
}

/**
 * JWT response structure
 */
export interface JWTResponse {
  jwt?: string;
  token?: string;
  token_expires?: string;
  [key: string]: any;
}

/**
 * Model definition structure
 */
export interface ModelDefinition {
  [key: string]: any;
}

/**
 * Group data structure
 */
export interface GroupData {
  group: string[];
}
