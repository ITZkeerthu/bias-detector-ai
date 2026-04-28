// Shared API client for the Bias Firewall frontend
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('bf_access_token');
}

export function setToken(token) {
  localStorage.setItem('bf_access_token', token);
}

export function clearToken() {
  localStorage.removeItem('bf_access_token');
}

export function isLoggedIn() {
  return !!getToken();
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

// Auth
export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  setToken(data.access_token);
  return data;
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' }).catch(() => {});
  clearToken();
}

export async function getMe() {
  return request('/auth/me');
}

export async function signup(email, password) {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
}

// Chat
export async function submitChat(prompt, modelId, forceBias = false) {
  return request('/chat/submit', {
    method: 'POST',
    body: JSON.stringify({ prompt, model_id: modelId, force_bias: forceBias }),
  });
}

export async function getSessions(page = 1, limit = 20) {
  return request(`/chat/sessions?page=${page}&limit=${limit}`);
}

export async function getModels() {
  return request('/chat/models');
}

// Bias
export async function getBiasReport(sessionId) {
  return request(`/bias/report/${sessionId}`);
}

export async function getBiasSummary() {
  return request('/bias/summary');
}

// Dashboard
export async function getDashboardStats() {
  return request('/dashboard/stats');
}

export async function getTimeseries(period = '7d') {
  return request(`/dashboard/timeseries?period=${period}`);
}

export async function getAttributeHeatmap() {
  return request('/dashboard/attribute-heatmap');
}

// Logs
export async function getLogs(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/logs${qs ? '?' + qs : ''}`);
}

// Health check
export async function checkHealth() {
  return request('/health');
}

// Retrain dataset export
export async function prepareDataset(filters = {}) {
  return request('/retrain/prepare', { method: 'POST', body: JSON.stringify({ filters }) });
}

export async function downloadDataset(exportId) {
  const token = localStorage.getItem('bf_access_token');
  const res = await fetch(`/api/retrain/download/${exportId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || 'Download failed');
  }
  return res.blob();
}

export async function getReportData() {
  return request('/retrain/report');
}
