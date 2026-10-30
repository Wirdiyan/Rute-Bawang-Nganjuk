const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export async function apiGet(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke backend RouteBawang AI. Pastikan FastAPI sedang berjalan.');
  }

  if (!response.ok) {
    let message = `Permintaan ke backend gagal (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
      // Keep the useful HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export { API_BASE_URL };
