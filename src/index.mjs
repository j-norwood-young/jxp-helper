import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjs = require('./index.js');

export const JXPHelper = cjs.JXPHelper;
export const JXPError = cjs.JXPError;
export default cjs.default ?? cjs.JXPHelper;
