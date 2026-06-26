const API_BASE = import.meta.env.PROD ? "" : import.meta.env.VITE_API_BASE ?? "";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }

  return response.json();
}

export async function fetchLatestRate() {
  const payload = await request("/api/latest");
  return payload.data;
}

export async function fetchRateHistory() {
  const payload = await request("/api/history?limit=365");
  return payload.data;
}

export async function refreshTodayRate() {
  return request("/api/refresh");
}
