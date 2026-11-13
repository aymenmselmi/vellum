// Same-origin JSON API. Session cookies are HttpOnly and never read by JavaScript.
let csrfToken = null;
export function setCsrfToken(value) { csrfToken = value; }

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Vellum est injoignable. Vérifiez votre connexion et réessayez.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('vellum:session-expired'));
    const error = new Error(data?.error || 'La demande a échoué. Veuillez réessayer.');
    error.status = response.status;
    throw error;
  }
  if (response.status !== 204 && !data) throw new Error('Le service est indisponible. Veuillez réessayer dans un instant.');
  return data;
}
