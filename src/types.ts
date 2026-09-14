/**
 * Configuration options for JXPHelper
 */
export interface JXPHelperOptions {
  /** The server URL */
  server: string;
  /** The API key sent in the X-API-Key header */
  apikey?: string;
  /** The bearer token sent in the Authorization header */
  token?: string;
  /** Whether to enable debug mode */
  debug?: boolean;
  /** Whether to hide errors */
  hideErrors?: boolean;
}

/**
 * Login response data
 */
export interface LoginData {
  user_id: string;
  [key: string]: any;
}

/**
 * User data structure
 */
export interface UserData {
  _id: string;
  email: string;
  [key: string]: any;
}

/**
 * Login response structure
 */
export interface LoginResponse {
  data: LoginData;
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
 * Query options for API requests
 */
export interface QueryOptions {
  [key: string]: string | number | boolean | string[] | number[];
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
