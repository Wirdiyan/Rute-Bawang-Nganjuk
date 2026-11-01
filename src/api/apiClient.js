const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method, signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Backend belum terhubung. Jalankan server Python, lalu coba lagi.');
  }
  if (!response.ok) {
    let message = `Permintaan gagal (${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data.detail === 'string') message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map((item) => item.msg).join('; ');
    } catch { /* Keep the HTTP status when no JSON error is available. */ }
    throw new Error(message);
  }
  return response.json();
}

export const apiGet = (path, options) => apiRequest(path, options);
export { API_BASE_URL };
