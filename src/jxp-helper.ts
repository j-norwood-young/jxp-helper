import {
  JXPHelperOptions,
  LoginResponse,
  TokenPair,
  MfaRequiredResponse,
  LoginStepResult,
  isMfaRequired,
  UserData,
  ApiResponse,
  BulkWriteOperation,
  QueryOptions,
  CountResponse,
  JWTResponse,
  ModelDefinition,
  GroupData
} from './types';
import { jxpRequest } from './http';
import { JXPError } from './errors';

/**
 * JXPHelper class for interacting with a JXP server.
 */
export class JXPHelper {
  public server!: string;
  public apikey?: string;
  public token?: string;
  public api!: string;
  public debug!: boolean;
  public hideErrors!: boolean;

  /**
   * Creates a new instance of the JXP Helper class.
   * @param opts - The options for configuring the JXP Helper.
   * Provide `apikey` and/or `token`. Credentials may be omitted when only calling
   * unauthenticated auth endpoints (`login`, `completeMfa`, `refresh`).
   */
  constructor(opts: JXPHelperOptions) {
    const defaults: Partial<JXPHelperOptions> = {
      debug: false,
      hideErrors: false
    };
    const config = Object.assign({}, defaults, opts);
    this.config(config);
    if (!this.server) throw new Error("parameter 'server' required");
    this.api = this.server + "/api";
  }

  /**
   * Configures the options for the jxp-helper.
   * @param opts - The options to configure.
   */
  config(opts: Partial<JXPHelperOptions>): void {
    for (const opt in opts) {
      if (opts.hasOwnProperty(opt)) {
        (this as any)[opt] = (opts as any)[opt];
      }
    }
  }

  /** Prefer bearer access token for subsequent authenticated calls. */
  useAccessToken(accessToken: string): this {
    this.token = accessToken;
    return this;
  }
  
  private _isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private _isEmptyParam(value: unknown): boolean {
    return value === null || value === undefined || value === '';
  }

  private _encodeParam(key: string, value: string | number | boolean): string {
    return key + '=' + encodeURIComponent(String(value));
  }

  private _appendObjectEntries(
    parts: string[],
    prefix: string,
    obj: Record<string, unknown>
  ): void {
    for (const sub of Object.keys(obj)) {
      const value = obj[sub];
      if (this._isEmptyParam(value)) continue;
      if (this._isPlainObject(value) || Array.isArray(value)) continue;
      parts.push(this._encodeParam(`${prefix}[${sub}]`, value as string | number | boolean));
    }
  }

  private _configParams(opts: QueryOptions = {}): string {
    const parts: string[] = [];
    for (const opt in opts) {
      if (['apikey', 'api_key', 'apiKey', 'x-api-key'].includes(opt.toLowerCase())) continue;
      const value = opts[opt];
      if (this._isEmptyParam(value)) continue;

      // `filters` (plural) → expand into `filter[key]=value` (never send `filters=`).
      if (opt === 'filters') {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (this._isPlainObject(item)) this._appendObjectEntries(parts, 'filter', item);
          }
        } else if (this._isPlainObject(value)) {
          this._appendObjectEntries(parts, 'filter', value);
        }
        continue;
      }

      // `search: { q: '…' }` → full-text `search=…`; other objects → `search[field]=…`.
      if (opt === 'search' && this._isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === 'q') {
          const q = value.q;
          if (!this._isEmptyParam(q) && (typeof q === 'string' || typeof q === 'number' || typeof q === 'boolean')) {
            const trimmed = String(q).trim();
            if (trimmed) parts.push(this._encodeParam('search', trimmed));
          }
        } else {
          this._appendObjectEntries(parts, 'search', value);
        }
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (this._isEmptyParam(item)) continue;
          if (this._isPlainObject(item)) {
            this._appendObjectEntries(parts, opt, item);
          } else if (!Array.isArray(item)) {
            parts.push(this._encodeParam(opt, item as string | number | boolean));
          }
        }
        continue;
      }

      if (this._isPlainObject(value)) {
        this._appendObjectEntries(parts, opt, value);
        continue;
      }

      parts.push(this._encodeParam(opt, value as string | number | boolean));
    }
    return parts.join('&');
  }

  private _randomString(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private _displayError(err: unknown): void {
    try {
      if (this.hideErrors) return;
      if (err instanceof JXPError) {
        console.error(`${new Date().toISOString()}\turl: ${err.url}\tmethod: ${err.method}\tstatus: ${err.status}\tstatusText: ${err.statusText}\tdata: ${err.body ? JSON.stringify(err.body) : 'No data'}`);
      } else {
        console.error(err);
      }
    } catch (error) {
      console.error(error);
    }
  }

  private _request<T>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    return jxpRequest<T>(url, this.apikey, this.token, options);
  }

  private async _hydrateLogin(data: TokenPair): Promise<LoginResponse> {
    this.token = data.token;
    // Prefer bearer for the user fetch even if a system API key is also configured.
    const user = await jxpRequest<UserData>(
      `${this.api}/user/${data.user_id}`,
      undefined,
      data.token
    );
    return { data, user };
  }

  url(type: string, opts?: QueryOptions, ep: string = "api"): string {
    const params = this._configParams(opts);
    return `${this.server}/${ep}/${type}${params ? `?${params}` : ''}`;
  }

  /**
   * Password login. May return an MFA challenge instead of tokens.
   * On success, stores the access token on this helper for subsequent calls.
   */
  async login(email: string, password: string): Promise<LoginResponse | MfaRequiredResponse> {
    const data = await this._request<LoginStepResult>(`${this.server}/login`, {
      method: 'POST',
      body: { email, password }
    });
    if (isMfaRequired(data)) return data;
    if (!data?.token || !data?.user_id) {
      throw new Error('Login response missing token/user_id');
    }
    return this._hydrateLogin(data);
  }

  /**
   * Complete MFA after `login` returned `{ status: "mfa_required", challenge, methods }`.
   */
  async completeMfa(opts: {
    challenge: string;
    code: string;
    method?: string;
  }): Promise<LoginResponse> {
    const data = await this._request<TokenPair>(`${this.server}/login/mfa`, {
      method: 'POST',
      body: {
        method: opts.method || 'totp',
        challenge: opts.challenge,
        code: String(opts.code).trim().replace(/\s+/g, '')
      }
    });
    if (!data?.token || !data?.user_id) {
      throw new Error('MFA response missing token/user_id');
    }
    return this._hydrateLogin(data);
  }

  /**
   * Exchange a refresh token for a new access / refresh pair.
   */
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const data = await jxpRequest<TokenPair>(
      `${this.server}/refresh`,
      undefined,
      refreshToken,
      { method: 'POST' }
    );
    if (!data?.token || !data?.user_id) {
      throw new Error('Refresh response missing token/user_id');
    }
    return this._hydrateLogin(data);
  }

  /**
   * Retrieves a single item of a specified type by its ID.
   * @param type - The type of the item.
   * @param id - The ID of the item.
   * @param opts - Additional options for the request.
   * @returns A promise that resolves to the retrieved item.
   * @throws If the request fails or returns a non-200 status code.
   */
  async getOne<T = any>(type: string, id: string, opts?: QueryOptions): Promise<T> {
    const label = `getOne.${type}-${this._randomString()}`;
    if (this.debug) console.time(label);
    const url = `${this.api}/${type}/${id}?${this._configParams(opts)}`;
    try {
      const result = await this._request<T>(url);
      if (this.debug) console.timeEnd(label);
      return result;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Retrieves data of a specified type from a URL.
   * @param type - The type of data to retrieve.
   * @param opts - Additional options for the request.
   * @returns A promise that resolves with the retrieved data.
   * @throws If the request fails or returns a non-200 status code.
   */
  async get<T = any>(type: string, opts?: QueryOptions): Promise<ApiResponse<T>> {
    const label = `get.${type}-${this._randomString()}`;
    if (this.debug) console.time(label);
    const url = this.url(type, opts);
    try {
      const result = await this._request<ApiResponse<T>>(url);
      if (this.debug) console.timeEnd(label);
      return result;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Retrieves data in CSV format from the server.
   * @param type - The type of data to retrieve.
   * @param opts - Additional options for the request.
   * @returns The CSV data.
   * @throws If the request fails or returns a non-200 status code.
   */
  async csv(type: string, opts?: QueryOptions): Promise<string> {
    const label = `get.${type}-${this._randomString()}`;
    if (this.debug) console.time(label);
    const url = `${this.server}/csv/${type}?${this._configParams(opts)}`;
    try {
      const result = await this._request<string>(url);
      if (this.debug) console.timeEnd(label);
      return result;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Executes a query of the specified type with the given parameters.
   * @param type - The type of query to execute.
   * @param query - The query string.
   * @param opts - Additional options for the query.
   * @returns A promise that resolves to the query result.
   * @throws If the query fails or returns a non-200 status code.
   */
  async query<T = any>(type: string, query: string, opts?: QueryOptions): Promise<T> {
    const label = `query.${type}-${this._randomString()}`;
    if (this.debug) console.time(label);
    const url = `${this.server}/query/${type}?${this._configParams(opts)}`;
    try {
      const result = await this._request<T>(url, { method: 'POST', body: { query } });
      if (this.debug) console.timeEnd(label);
      return result;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Performs an aggregate operation on the specified type with the given query and options.
   * @param type - The type to perform the aggregate operation on.
   * @param query - The query object for the aggregate operation.
   * @param opts - The options for the aggregate operation.
   * @returns The result of the aggregate operation.
   * @throws If the aggregate operation fails.
   */
  async aggregate<T = any>(type: string, query: Record<string, any>, opts?: QueryOptions): Promise<T> {
    const label = `aggregate.${type}-${this._randomString()}`;
    if (this.debug) console.time(label);
    const url = `${this.server}/aggregate/${type}?${this._configParams(opts)}`;
    try {
      const result = await this._request<T>(url, { method: 'POST', body: { query } });
      if (this.debug) console.timeEnd(label);
      return result;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Performs a bulk post or put operation.
   * If the data parameter is an array, it performs a bulk update operation.
   * If the data parameter is an object, it performs a single post or put operation.
   * @param type - The type of operation to perform (post or put).
   * @param key - The key(s) used to filter the data for the update operation.
   * @param data - The data to be updated or inserted.
   * @returns A promise that resolves with the result of the bulk operation.
   * @throws If an error occurs during the bulk operation.
   */
  async bulk_postput(type: string, key: string | string[], data: Record<string, any> | Record<string, any>[]): Promise<any> {
    try {
      if (!Array.isArray(data)) return await this.postput(type, key as string, data);
      const updates: BulkWriteOperation[] = data.map(item => {
        const updateQuery: BulkWriteOperation = {
          updateOne: {
            upsert: true,
            update: item as Record<string, any>,
            filter: {}
          }
        };
        if (Array.isArray(key)) {
          key.forEach(k => {
            updateQuery.updateOne!.filter[k] = (item as any)[k];
          });
        } else {
          updateQuery.updateOne!.filter[key] = (item as any)[key];
        }
        return updateQuery;
      });
      const url = `${this.server}/bulkwrite/${type}`;
      return await this._request(url, { method: 'POST', body: updates });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Performs a bulk update operation for a given type of data.
   * @param type - The type of data to update.
   * @param key - The key to use for filtering and updating the data.
   * @param data - The array of data objects to update.
   * @returns A promise that resolves to the response data from the bulk update operation.
   * @throws If an error occurs during the bulk update operation.
   */
  async bulk_put(type: string, key: string, data: Record<string, any>[]): Promise<any> {
    try {
      const updates: BulkWriteOperation[] = data.map(item => {
        const updateQuery: BulkWriteOperation = {
          updateOne: {
            upsert: false,
            update: item as Record<string, any>,
            filter: {}
          }
        };
        updateQuery.updateOne!.filter[key] = (item as any)[key];
        return updateQuery;
      });
      const url = `${this.server}/bulkwrite/${type}`;
      return await this._request(url, { method: 'POST', body: updates });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Performs a bulk post operation.
   * @param type - The type of data to be posted.
   * @param data - The data to be posted.
   * @returns A promise that resolves with the response data.
   * @throws If an error occurs during the operation.
   */
  async bulk_post(type: string, data: Record<string, any>[]): Promise<any> {
    try {
      const updates: BulkWriteOperation[] = data.map(item => {
        return {
          insertOne: {
            document: item
          }
        };
      });
      const url = `${this.server}/bulkwrite/${type}`;
      return await this._request(url, { method: 'POST', body: updates });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Performs a bulk write operation for a given type using the specified query.
   * @param type - The type of the bulk write operation.
   * @param query - The query object for the bulk write operation.
   * @returns A promise that resolves to the result of the bulk write operation.
   * @throws If an error occurs during the bulk write operation.
   */
  async bulk(type: string, query: BulkWriteOperation[]): Promise<any> {
    try {
      if (this.debug) console.log("bulk", type);
      const url = `${this.server}/bulkwrite/${type}`;
      return await this._request(url, { method: 'POST', body: query });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Updates multiple documents of a specified type in the database.
   * @param type - The type of documents to update.
   * @param data - The data to update the documents with.
   * @returns The response data from the database.
   * @throws If an error occurs during the update process.
   */
  async put_all(type: string, data: Record<string, any>): Promise<any> {
    try {
      if (this.debug) console.log("put_all", type);
      const query: BulkWriteOperation[] = [
        {
          updateMany: {
            upsert: false,
            filter: {},
            update: { $set: data },
          },
        }
      ];
      const url = `${this.server}/bulkwrite/${type}`;
      return await this._request(url, { method: 'POST', body: query });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Counts the number of items of a given type.
   * @param type - The type of items to count.
   * @param opts - Additional options for counting.
   * @returns The count of items.
   */
  async count(type: string, opts?: QueryOptions): Promise<number> {
    const label = `count.${type}-${this._randomString()}`;
    if (this.debug) console.time(label);
    const options = opts || {};
    options.limit = 1;
    const url = this.url(type, options, "count");
    try {
      const result = await this._request<CountResponse>(url);
      if (this.debug) console.timeEnd(label);
      return result.count;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Creates a new record by making a POST request to the specified URL.
   * @param type - The type of data to post.
   * @param data - The data to post.
   * @returns The response data from the post operation.
   */
  async post<T = any>(type: string, data: T): Promise<any> {
    const url = `${this.api}/${type}`;
    if (this.debug) console.log("POSTing to ", url, data);
    try {
      return await this._request(url, { method: 'POST', body: data });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Updates an existing record by making a PUT request to the specified URL.
   * @param type - The type of the record.
   * @param id - The ID of the record.
   * @param data - The data to be sent in the request body.
   * @returns A promise that resolves to the response data.
   * @throws If an error occurs during the request.
   */
  async put<T = any>(type: string, id: string, data: T): Promise<any> {
    const url = `${this.api}/${type}/${id}`;
    if (this.debug) console.log("PUTting to ", url, data);
    try {
      return await this._request(url, { method: 'PUT', body: data });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Performs a POST or PUT request based on the existence of a specific key in the data object.
   * If the key exists in the data object, a PUT request is made with the corresponding ID.
   * If the key does not exist, a POST request is made with the data object.
   * @param type - The type of resource to perform the request on.
   * @param key - The key to check in the data object.
   * @param data - The data object to be sent in the request.
   * @returns A promise that resolves with the response data or rejects with an error.
   */
  async postput(type: string, key: string, data: Record<string, any>): Promise<any> {
    // Post if we find key=id, else put
    const obj: QueryOptions = {};
    obj[`filter[${key}]`] = data[key];
    try {
      const result = await this.get(type, obj);
      if (result.data.length) {
        const id = result.data[0]._id;
        return this.put(type, id, data);
      } else {
        return this.post(type, data);
      }
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }
  
  /**
   * Deletes an item of the specified type by its ID.
   * @param type - The type of the item to delete.
   * @param id - The ID of the item to delete.
   * @returns A promise that resolves to the deleted item.
   * @throws If an error occurs during the deletion process.
   */
  async del(type: string, id: string): Promise<any> {
    const url = `${this.api}/${type}/${id}`;
    try {
      return await this._request(url, { method: 'DELETE' });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Deletes a resource permanently.
   * @param type - The type of resource to delete.
   * @param id - The ID of the resource to delete.
   * @returns A promise that resolves to the deleted resource data.
   * @throws If an error occurs during the deletion process.
   */
  async del_perm(type: string, id: string): Promise<any> {
    const url = `${this.api}/${type}/${id}?_permaDelete=1`;
    try {
      return await this._request(url, { method: 'DELETE' });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Soft Deletes a resource and its cascading dependencies.
   * @param type - The type of the resource to delete.
   * @param id - The ID of the resource to delete.
   * @returns A promise that resolves with the deleted resource data.
   * @throws If an error occurs during the deletion process.
   */
  async del_cascade(type: string, id: string): Promise<any> {
    const url = `${this.api}/${type}/${id}?_cascade=1`;
    try {
      return await this._request(url, { method: 'DELETE' });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Permanently Deletes a resource and its associated data permanently, including all cascading dependencies.
   * @param type - The type of resource to delete.
   * @param id - The ID of the resource to delete.
   * @returns A promise that resolves to the response data from the delete request.
   * @throws If an error occurs during the delete request.
   */
  async del_perm_cascade(type: string, id: string): Promise<any> {
    const url = `${this.api}/${type}/${id}?_cascade=1&_permaDelete=1`;
    try {
      return await this._request(url, { method: 'DELETE' });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Deletes all items of a specified type that match a given key-value pair.
   * @param type - The type of items to delete.
   * @param key - The key to filter the items.
   * @param id - The value to match against the key.
   * @returns A promise that resolves to an array of results from deleting each item.
   * @throws If an error occurs during the deletion process.
   */
  async del_all(type: string, key: string, id: string): Promise<any[]> {
    const obj: QueryOptions = {};
    obj[`filter[${key}]`] = id;
    try {
      const results: any[] = [];
      const items = (await this.get(type, obj)).data;
      for (const item of items) {
        results.push(await this.del(type, item._id));
      }
      return results;
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  async sync<T = any>(type: string, key: string, id: string, data: T[]): Promise<any[]> {
    // Given the records filtered by key = id, we create, update or delete until we are in sync with data.
    const obj: QueryOptions = {};
    obj[`filter[${key}]`] = id;
    try {
      const results: any[] = [];
      const existingData = (await this.get(type, obj)).data;
      const data_ids = existingData.filter(row => row._id).map(row => row._id);
      const dest_ids = data.map((row: any) => row._id).filter(id => id);
      const deletes = data_ids.filter(n => dest_ids.indexOf(n) === -1) || [];
      const moreinserts = dest_ids.filter(n => data_ids.indexOf(n) === -1) || [];
      const inserts = data.filter((row: any) => moreinserts.indexOf(row._id) !== -1 || !row._id) || [];
      const update_ids = dest_ids.filter(n => data_ids.indexOf(n) !== -1) || [];
      const updates = data.filter((row: any) => update_ids.indexOf(row._id) !== -1) || [];
      
      for (const insert of inserts) {
        if (this.debug) console.log("Inserting", insert);
        results.push(await this.post(type, insert));
      }
      for (const update of updates) {
        if (this.debug) console.log("Updating", update);
        results.push(await this.put(type, (update as any)._id, update));
      }
      for (const del of deletes) {
        if (this.debug) console.log("Deleting", del);
        results.push(await this.del(type, del));
      }
      return results;
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Calls a function in the model.
   * @param type - The type of the function.
   * @param cmd - The command to be executed.
   * @param data - The data to be sent with the request.
   * @returns A promise that resolves to the response data.
   * @throws Throws an error if the request fails.
   */
  async call<T = any>(type: string, cmd: string, data: any): Promise<T> {
    //Call a function in the model
    const url = `${this.server}/call/${type}/${cmd}`;
    if (this.debug) console.log("CALLing  ", url, data);
    try {
      return await this._request<T>(url, { method: 'POST', body: data });
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Retrieves the groups for a user.
   * @param user_id - The ID of the user.
   * @returns A promise that resolves to the usergroup document (or `{ groups: [] }`).
   * @throws If an error occurs during the request.
   */
  async groups_get(user_id: string): Promise<any> {
    const url = `${this.server}/groups/${user_id}`;
    try {
      return await this._request(url);
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Updates the groups for a user.
   * @param user_id - The ID of the user.
   * @param groups - The groups to update.
   * @returns A promise that resolves to the updated data.
   * @throws If an error occurs during the update.
   */
  async groups_put(user_id: string, groups: string[]): Promise<any> {
    const url = `${this.server}/groups/${user_id}`;
    try {
      return await this._request(url, { method: 'PUT', body: { group: groups } });
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Deletes a group for a specific user.
   * @param user_id - The ID of the user.
   * @param group - The name of the group to delete.
   * @returns A promise that resolves to the response data from the server.
   * @throws If an error occurs during the deletion process.
   */
  async groups_del(user_id: string, group: string): Promise<any> {
    const url = `${this.server}/groups/${user_id}?group=${encodeURIComponent(group)}`;
    try {
      return await this._request(url, { method: 'DELETE' });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Add a user to a group
   * @param user_id - The ID of the user.
   * @param groups - The groups to be posted.
   * @returns A promise that resolves to the response data.
   * @throws If an error occurs during the post request.
   */
  async groups_post(user_id: string, groups: string[]): Promise<any> {
    const url = `${this.server}/groups/${user_id}`;
    const data: GroupData = { group: groups };
    if (this.debug) console.log("GROUP POSTing", url, data);
    try {
      return await this._request(url, { method: 'POST', body: data });
    } catch (err: any) {
      this._displayError(err);
      throw err;
    }
  }

  /**
   * Generates a JWT (JSON Web Token) for the specified email.
   * @param email - The email address used for authentication.
   * @returns A promise that resolves with the JWT.
   * @throws If an error occurs during the retrieval of the JWT.
   */
  async getjwt(email: string): Promise<JWTResponse> {
    try {
      return await this._request<JWTResponse>(`${this.server}/login/getjwt`, { method: 'POST', body: { email } });
    } catch (err: any) {
      if (err instanceof JXPError)
        return Promise.reject(err.body);
      return Promise.reject(err);
    }
  }

  /**
   * Retrieves the definition of a model from the server.
   * @param modelname - The name of the model to retrieve.
   * @returns A promise that resolves to the model definition.
   * @throws If an error occurs during the retrieval process.
   */
  async model(modelname: string): Promise<ModelDefinition> {
    try {
      return await this._request<ModelDefinition>(`${this.server}/model/${modelname}`);
    } catch (err: any) {
      if (err instanceof JXPError)
        return Promise.reject(err.body);
      return Promise.reject(err);
    }
  }

  /**
   * Retrieves the model definitions from the server.
   * @returns A promise that resolves to the model definitions.
   * @throws If an error occurs while retrieving the model definitions.
   */
  async models(): Promise<ModelDefinition[]> {
    try {
      return await this._request<ModelDefinition[]>(`${this.server}/model`);
    } catch (err: any) {
      if (err instanceof JXPError)
        return Promise.reject(err.body);
      return Promise.reject(err);
    }
  }
}

export default JXPHelper;
