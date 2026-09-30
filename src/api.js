export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something didn’t connect. Please try again.');
    error.status = response.status;
    if (response.status === 401 && path !== '/unlock' && path !== '/session') window.dispatchEvent(new Event('becoming:session-ended'));
    throw error;
  }
  if ((path.startsWith('/journal') && ['POST', 'DELETE'].includes(options.method)) || (path === '/voice/config' && ['PUT', 'DELETE'].includes(options.method))) window.dispatchEvent(new Event('hpy:journey-changed'));
  return data;
}
