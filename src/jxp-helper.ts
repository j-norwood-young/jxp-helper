import axios, { AxiosResponse, AxiosError } from 'axios';
import {
  JXPHelperOptions,
  LoginResponse,
  LoginData,
  UserData,
  ApiResponse,
  BulkWriteOperation,
  QueryOptions,
  CountResponse,
  JWTResponse,
  ModelDefinition,
  GroupData
} from './types';

/**
 * JXPHelper class for interacting with a JXP server.
 */
export class JXPHelper {
  public server!: string;
  public apikey!: string;
  public api!: string;
  public debug!: boolean;
  public hideErrors!: boolean;

  /**
   * Creates a new instance of the JXP Helper class.
   * @param opts - The options for configuring the JXP Helper.
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
  
  private _configParams(opts: QueryOptions = {}): string {
    opts.apikey = this.apikey;
    const parts: string[] = [];
    for (const opt in opts) {
      if (Array.isArray(opts[opt])) {
        (opts[opt] as (string | number)[]).forEach(val => {
          parts.push(opt + "=" + encodeURIComponent(val.toString()));
        });
      } else {
        parts.push(opt + "=" + encodeURIComponent(opts[opt].toString()));
      }
    }
    return parts.join("&");
  }

  private _randomString(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private _displayError(err: AxiosError): void {
    try {
      if (this.hideErrors) return;
      const config = err.config;
      const response = err.response;
      console.error(`${new Date().toISOString()}\turl: ${config?.url}\tmethod: ${config?.method}\tstatus: ${response?.status}\tstatusText: ${response?.statusText}\tdata: ${(response?.data) ? JSON.stringify(response.data) : 'No data'}`);
    } catch (error) {
      console.error(error);
    }
  }

  url(type: string, opts?: QueryOptions, ep: string = "api"): string {
    return `${this.server}/${ep}/${type}?${this._configParams(opts)}`;
  }

  /**
   * Logs in a user with the provided email and password.
   * @param email - The user's email.
   * @param password - The user's password.
   * @returns A promise that resolves to an object containing the login data and user information, or rejects with an error object.
   */
  async login(email: string, password: string): Promise<LoginResponse | any> {
    try {
      const data: LoginData = (await axios.post(`${this.server}/login`, { email, password })).data;
      const user: UserData = (await axios.get(`${this.api}/user/${data.user_id}?apikey=${this.apikey}`)).data;
      return { data, user };
    } catch (err: any) {
      return err.response?.data;
    }
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
      const result: AxiosResponse<T> = await axios.get(url);
      if (this.debug) console.timeEnd(label);
      if (result.status !== 200) {
        throw new Error(result.statusText);
      }
      return result.data;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const result: AxiosResponse<ApiResponse<T>> = await axios.get(url);
      if (this.debug) console.timeEnd(label);
      if (result.status !== 200) {
        throw new Error(result.statusText);
      }
      return result.data;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const result: AxiosResponse<string> = await axios.get(url);
      if (this.debug) console.timeEnd(label);
      if (result.status !== 200) {
        throw new Error(result.statusText);
      }
      return result.data;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const result: AxiosResponse<T> = await axios.post(url, { query });
      if (this.debug) console.timeEnd(label);
      if (result.status !== 200) {
        throw new Error(result.statusText);
      }
      return result.data;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const result: AxiosResponse<T> = await axios.post(url, { query });
      if (this.debug) console.timeEnd(label);
      if (result.status !== 200) {
        throw new Error(result.statusText);
      }
      return result.data;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
      return (await axios.post(url, updates)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
      return (await axios.post(url, updates)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
      return (await axios.post(url, updates)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
      return (await axios.post(url, query)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
      return (await axios.post(url, query)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const result: AxiosResponse<CountResponse> = await axios.get(url);
      if (this.debug) console.timeEnd(label);
      if (result.status !== 200) {
        throw new Error(result.statusText);
      }
      return result.data.count;
    } catch (err: any) {
      if (this.debug) console.timeEnd(label);
      this._displayError(err);
      throw (err.response ? err.response.data : err);
    }
  }

  /**
   * Creates a new record by making a POST request to the specified URL.
   * @param type - The type of data to post.
   * @param data - The data to post.
   * @returns The response data from the post operation.
   */
  async post<T = any>(type: string, data: T): Promise<any> {
    const url = `${this.api}/${type}?apikey=${this.apikey}`;
    if (this.debug) console.log("POSTing to ", url, data);
    try {
      return (await axios.post(url, data)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
    const url = `${this.api}/${type}/${id}?apikey=${this.apikey}`;
    if (this.debug) console.log("PUTting to ", url, data);
    try {
      return (await axios.put(url, data)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      throw (err.response ? err.response.data : err);
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
    const url = `${this.api}/${type}/${id}?apikey=${this.apikey}`;
    try {
      return (await axios.delete(url)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
    const url = `${this.api}/${type}/${id}?_permaDelete=1&apikey=${this.apikey}`;
    try {
      return (await axios.delete(url)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
    const url = `${this.api}/${type}/${id}?_cascade=1&apikey=${this.apikey}`;
    try {
      return (await axios.delete(url)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
    const url = `${this.api}/${type}/${id}?_cascade=1&_permaDelete=1&apikey=${this.apikey}`;
    try {
      return (await axios.delete(url)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      throw (err.response ? err.response.data : err);
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
      throw (err.response ? err.response.data : err);
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
    const url = `${this.server}/call/${type}/${cmd}?apikey=${this.apikey}`;
    if (this.debug) console.log("CALLing  ", url, data);
    try {
      return (await axios.post(url, data)).data;
    } catch (err: any) {
      throw (err.response ? err.response.data : err);
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
    const url = `${this.server}/groups/${user_id}?apikey=${this.apikey}`;
    try {
      return (await axios.put(url, { group: groups })).data;
    } catch (err: any) {
      throw (err.response ? err.response.data : err);
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
    const url = `${this.server}/groups/${user_id}?group=${group}&apikey=${this.apikey}`;
    try {
      return (await axios.delete(url)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
    const url = `${this.server}/groups/${user_id}?apikey=${this.apikey}`;
    const data: GroupData = { group: groups };
    if (this.debug) console.log("GROUP POSTing", url, data);
    try {
      return (await axios.post(url, data)).data;
    } catch (err: any) {
      this._displayError(err);
      throw (err.response ? err.response.data : err);
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
      const jwt: JWTResponse = (await axios.post(`${this.server}/login/getjwt?apikey=${this.apikey}`, { email })).data;
      return jwt;
    } catch (err: any) {
      if (err.response && err.response.data)
        return Promise.reject(err.response.data);
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
      const modeldef: ModelDefinition = (await axios.get(`${this.server}/model/${modelname}?apikey=${this.apikey}`)).data;
      return modeldef;
    } catch (err: any) {
      if (err.response && err.response.data)
        return Promise.reject(err.response.data);
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
      const modeldef: ModelDefinition[] = (await axios.get(`${this.server}/model?apikey=${this.apikey}`)).data;
      return modeldef;
    } catch (err: any) {
      if (err.response && err.response.data)
        return Promise.reject(err.response.data);
      return Promise.reject(err);
    }
  }
}

export default JXPHelper;
