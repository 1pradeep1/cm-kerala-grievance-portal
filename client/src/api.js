// Thin fetch wrapper: adds the login token, sends JSON or FormData, throws readable errors.
const TOKEN_KEY = 'cmk_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try { res = await fetch(`/api${path}`, { method, headers, body: payload }); }
  catch { throw new Error('Cannot reach the server. Please check your connection and try again.'); }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Files need the login token, so they are fetched and shown through a temporary blob URL.
export async function openAttachment(id) {
  const res = await fetch(`/api/attachments/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Could not open the file');
  window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener');
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-');
