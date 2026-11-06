// Everything goes through the API (WORKFLOW.md 9.1): the interface never works out prices, matches
// or who may see what. The token is kept in this browser and sent with each request, never in an address.

const TOKEN = 'ir.token';
const ADMIN = 'ir.admin';

function read(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function write(store, key, value) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* private mode: the session just lasts until the page closes */
  }
}

let memoryToken = null;
let memoryAdmin = null;

export const session = {
  /** The signed-in account (from `GET /auth/me`), or null. */
  user: null,
  get token() {
    return read(localStorage, TOKEN) ?? memoryToken;
  },
  set token(value) {
    memoryToken = value;
    write(localStorage, TOKEN, value);
  },
  get adminKey() {
    return read(sessionStorage, ADMIN) ?? memoryAdmin;
  },
  set adminKey(value) {
    memoryAdmin = value;
    write(sessionStorage, ADMIN, value);
  },
  signOut() {
    this.token = null;
    this.user = null;
  },
};

export class ApiError extends Error {
  constructor(status, message, admin = false) {
    super(message);
    this.status = status;
    this.admin = admin;
  }
}

export async function api(method, path, { body, admin = false } = {}) {
  const headers = {};
  if (admin) headers['x-admin-key'] = session.adminKey ?? '';
  else if (session.token) headers.authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'offline', admin);
  }
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!response.ok) {
    const message = data?.message;
    throw new ApiError(response.status, Array.isArray(message) ? message.join('; ') : (message ?? response.statusText), admin);
  }
  return data;
}

export const query = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
};
