var axios = require("axios");

class JXPHelper {
	constructor(opts) {
		this.config(opts);
		if (!this.server) throw ("parameter 'server' required");
		this.api = this.server + "/api";
	}
	
	config(opts) {
		for (var opt in opts) {
			this[opt] = opts[opt];
		}
	};
	
	_configParams(opts) {
		opts = opts || {};
		opts.apikey = this.apikey;
		var parts = [];
		for (var opt in opts) {
			if (Array.isArray(opts[opt])) {
				opts[opt].forEach(val => {
					parts.push(opt + "=" + encodeURIComponent(val));
				});
			} else {
				parts.push(opt + "=" + encodeURIComponent(opts[opt]));
			}
		}
		return parts.join("&");
	};

	_randomString() {
		return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	}

	_displayError(err) {
		try {
			console.error(`${new Date().toISOString()}\turl: ${err.config.url}\tmethod: ${err.request.method}\tstatus: ${err.response.status}\tstatusText: ${err.response.statusText}\tdata: ${(err.response.data) ? JSON.stringify(err.response.data) : 'No data'}`);
		} catch (parseErr) {
			console.error(err);
		}
	}

	url(type, opts, ep="api") {
		return `${this.server}/${ep}/${type}?${this._configParams(opts)}`;
	}

	async login(email, password) {
		try {
			const data = (await axios.post(`${this.server}/login`, { email, password })).data;
			const user = (await axios.get(`${this.api}/user/${data.user_id}?apikey=${this.apikey}`)).data;
			return { data, user };
		} catch (err) {
			return err.response.data;
		}
	}

	async getOne(type, id, opts) {
		const label = `getOne.${type}-${this._randomString()}`;
		if (this.debug) console.time(label);
		const url = `${this.api}/${type}/${id}?${this._configParams(opts)}`;
		try {
			var result = await axios.get(url);
			if (this.debug) console.timeEnd(label);
			if (result.status !== 200) {
				throw(result.statusText);
			}
			return result.data;
		} catch(err) {
			if (this.debug) console.timeEnd(label);
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async get(type, opts) {
		const label = `get.${type}-${this._randomString()}`;
		if (this.debug) console.time(label);
		var url = this.url(type, opts);
		try {
			var result = await axios.get(url);
			if (this.debug) console.timeEnd(label);
			if (result.status !== 200) {
				throw(result.statusText);
			}
			return result.data;
		} catch(err) {
			if (this.debug) console.timeEnd(label);
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async csv(type, opts) {
		const label = `get.${type}-${this._randomString()}`;
		if (this.debug) console.time(label);
		var url = `${this.server}/csv/${type}?${this._configParams(opts)}`;
		try {
			var result = await axios.get(url);
			if (this.debug) console.timeEnd(label);
			if (result.status !== 200) {
				throw(result.statusText);
			}
			return result.data;
		} catch(err) {
			if (this.debug) console.timeEnd(label);
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async query(type, query, opts) {
		const label = `query.${type}-${this._randomString()}`;
		if (this.debug) console.time(label);
		var url = `${this.server}/query/${type}?${this._configParams(opts)}`;
		try {
			var result = await axios.post(url, {query});
			if (this.debug) console.timeEnd(label);
			if (result.status !== 200) {
				throw(result.statusText);
			}
			return result.data;
		} catch(err) {
			if (this.debug) console.timeEnd(label);
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async aggregate(type, query, opts) {
		const label = `aggregate.${type}-${this._randomString()}`;
		if (this.debug) console.time(label);
		var url = `${this.server}/aggregate/${type}?${this._configParams(opts)}`;
		try {
			var result = await axios.post(url, { query });
			if (this.debug) console.timeEnd(label);
			if (result.status !== 200) {
				throw (result.statusText);
			}
			return result.data;
		} catch (err) {
			if (this.debug) console.timeEnd(label);
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async bulk_postput(type, key, data) {
		try {
			if (!Array.isArray(data)) return await JXPHelper.postput(type, key, data);
			const updates = data.map(item => {
				const updateQuery = {
					"updateOne": {
						"upsert": true
					}
				}
				updateQuery.updateOne.update = item;
				updateQuery.updateOne.filter = {};
				updateQuery.updateOne.filter[key] = item[key];
				return updateQuery;
			});
			const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
			return (await axios.post(url, updates)).data;
		} catch (err) {
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async bulk_put(type, key, data) {
		try {
			const updates = data.map(item => {
				const updateQuery = {
					"updateOne": {
						"upsert": false
					}
				}
				updateQuery.updateOne.update = item;
				updateQuery.updateOne.filter = {};
				updateQuery.updateOne.filter[key] = item[key];
				return updateQuery;
			});
			const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
			return (await axios.post(url, updates)).data;
		} catch (err) {
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async bulk_post(type, data) {
		try {
			const updates = data.map(item => {
				return {
					"insertOne": {
						"document": item
					}
				}
			});
			const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
			return (await axios.post(url, updates)).data;
		} catch (err) {
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async bulk(type, query) {
		try {
			if (this.debug) console.log("bulk", type);
			const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
			return (await axios.post(url, query)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	// A very fast way to update ALL rows in a collection, with no seatbelts
	async put_all(type, data) {
		try {
			if (this.debug) console.log("put_all", type);
			const query = [
				{
					"updateMany": {
						"upsert": false,
						filter: {},
						update: { $set: data },
					},
				}
			];
			const url = `${this.server}/bulkwrite/${type}?apikey=${this.apikey}`;
			return (await axios.post(url, query)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async count(type, opts) {
		const label = `count.${type}-${this._randomString()}`;
		if (this.debug) console.time(label);
		opts = opts || {};
		opts.limit = 1;
		var url = this.url(type, opts, "count");
		try {
			var result = await axios.get(url);
			if (this.debug) console.timeEnd(label);
			if (result.status !== 200) {
				throw (result.statusText);
			}
			return result.data.count;
		} catch (err) {
			if (this.debug) console.timeEnd(label);
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async post(type, data) {
		var url = `${this.api}/${type}?apikey=${this.apikey}`;
		if (this.debug) console.log("POSTing to ", url, data);
		try {
			return (await axios.post(url, data)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async put(type, id, data) {
		var url = `${this.api}/${type}/${id}?apikey=${this.apikey}`;
		if (this.debug) console.log("PUTting to ", url, data);
		try {
			return (await axios.put(url, data)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async postput(type, key, data) {
		// Post if we find key=id, else put
		var obj = {};
		obj[`filter[${key}]`] = data[key];
		try {
			var result = await this.get(type, obj);
			if (result.data.length) {
				var id = result.data[0]._id;
				return this.put(type, id, data);
			} else {
				return this.post(type, data);
			}
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async del(type, id) {
		const url = `${this.api}/${type}/${id}?apikey=${this.apikey}`;
		try {
			return (await axios.delete(url)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	// Permanently delete
	async del_perm(type, id) {
		const url = `${this.api}/${type}/${id}?_permaDelete=1&apikey=${this.apikey}`;
		try {
			return (await axios.delete(url)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async del_cascade(type, id) {
		var url = `${this.api}/${type}/${id}?_cascade=1&apikey=${this.apikey}`;
		try {
			return (await axios.delete(url)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async del_perm_cascade(type, id) {
		var url = `${this.api}/${type}/${id}?_cascade=1&_permaDelete=1&apikey=${this.apikey}`;
		try {
			return (await axios.delete(url)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	// This should be rewritten as an async pattern
	async del_all(type, key, id) {
		var obj = {};
		obj[`filter[${key}]`] = id;
		try {
			const results = [];
			const items = (await self.get(type, obj)).data;
			for (let item of items) {
				results.push(await this.del(type, item._id));
			}
			return results;
		} catch(err) {
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async sync(type, key, id, data) {
		// Given the records filtered by key = id, we create, update or delete until we are in sync with data.
		var obj = {};
		obj[`filter[${key}]`] = id;
		try {
			let results = [];
			const data = await this.get(type, obj).data;
			const data_ids = data.filter(row => row._id).map(row => row._id);
			const dest_ids = data.map(row => row._id);
			const deletes = dest_ids.filter(n => data_ids.indexOf(n) == -1) || [];
			const moreinserts = data_ids.filter(n => dest_ids.indexOf(n) == -1) || [];
			const inserts = data.filter(row => moreinserts.indexOf(row._id) != -1) || !(row._id);
			const update_ids = dest_ids.filter(n => data_ids.indexOf(n) != -1) || [];
			const updates = data.filter(row => update_ids.indexOf(row._id) != -1) || [];
			for (let insert of inserts) {
				if (this.debug) console.log("Inserting", insert);
				results.push(await this.post(type, insert));
			}
			for (let update of updates) {
				if (this.debug) console.log("Updating", update);
				results.push(await self.put(type, update._id, update));
			}
			for (let del of deletes) {
				if (this.debug) console.log("Deleting", del);
				results.push(await this.del(type, del));
			}
			return results;
		} catch(err) {
			this._displayError(err);
			throw (err.response ? err.response.data : err);
		}
	}

	async call(type, cmd, data) {
		//Call a function in the model
		var url = `${this.server}/call/${type}/${cmd}?apikey=${this.apikey}`;
		if (this.debug) console.log("CALLing  ", url, data);
		try {
			return (await axios.post(url, data)).data;
		} catch(err) {
			throw(err.response ? err.response.data : err);
		}
	}

	async groups_put(user_id, groups) {
		var url = `${this.server}/groups/${user_id}?apikey=${this.apikey}`;
		try {
			return (await axios.put(url, { group: groups })).data;
		} catch(err) {
			throw(err.response ? err.response.data : err);
		}
	}

	async groups_del(user_id, group) {
		var url = `${this.server}/groups/${user_id}?group=${group}&apikey=${this.apikey}`;
		try {
			return (await axios.delete(url)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async groups_post(user_id, groups) {
		var url = `${this.server}/groups/${user_id}?apikey=${this.apikey}`;
		var data = { group: groups };
		if (this.debug) console.log("GROUP POSTing", url, data);
		try {
			return (await axios.post(url, data)).data;
		} catch(err) {
			this._displayError(err);
			throw(err.response ? err.response.data : err);
		}
	}

	async getjwt(email) {
		try {
			const jwt = (await axios.post(`${ this.server }/login/getjwt?apikey=${ this.apikey }`, { email })).data;
			return jwt;
		} catch (err) {
			if (err.response && err.response.data)
				return Promise.reject(err.response.data);
			return Promise.reject(err);
		}
	}

	async model(modelname) {
		try {
			const modeldef = (await axios.get(`${ this.server }/model/${ modelname }?apikey=${ this.apikey }`)).data;
			return modeldef;
		} catch (err) {
			if (err.response && err.response.data)
				return Promise.reject(err.response.data);
			return Promise.reject(err);
		}
	}

	async models() {
		try {
			const modeldef = (await axios.get(`${ this.server }/model?apikey=${ this.apikey }`)).data;
			return modeldef;
		} catch (err) {
			if (err.response && err.response.data)
				return Promise.reject(err.response.data);
			return Promise.reject(err);
		}
	}
};

module.exports = JXPHelper;

