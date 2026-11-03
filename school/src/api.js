export const CLASSES = ['Nursery', 'KG1', 'KG2', ...Array.from({ length: 10 }, (_, i) => String(i + 1))];
export const SECTIONS = ['A', 'B', 'C'];
export const clsName = c => (['Nursery', 'KG1', 'KG2'].includes(c) ? c : 'Class ' + c);
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => today().slice(0, 7);
export async function api(path, { method = 'GET', body } = {}) {
  const t = localStorage.getItem('t'), camp = localStorage.getItem('campus'); let r, d;
  try {
    r = await fetch((import.meta.env.VITE_API || '') + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }), ...(camp && { 'x-campus': camp }) }, body: body && JSON.stringify(body) });
    d = await r.json();
  } catch {
    const e = new Error('Cannot connect to the server. Make sure the backend is running (npm start inside the backend folder) and MongoDB is connected.'); e.network = true; throw e;
  }
  if (r.status === 401 && t) { localStorage.removeItem('t'); window.dispatchEvent(new CustomEvent('loggedout', { detail: d.error })); }
  if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; }
  return d;
}
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayName = d => DAYS[new Date(d + 'T00:00:00').getDay()];
