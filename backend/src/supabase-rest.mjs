function encodeQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export class SupabaseRestClient {
  constructor({ supabaseUrl, supabaseKey }) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  get configured() {
    return Boolean(this.supabaseUrl && this.supabaseKey);
  }

  async get(path, params) {
    if (!this.configured) {
      const error = new Error('Backend API is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      error.status = 500;
      throw error;
    }

    const query = encodeQuery(params);
    const url = `${this.supabaseUrl}/rest/v1/${path}${query ? `?${query}` : ''}`;
    const response = await fetch(url, {
      headers: {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }
    if (!response.ok) {
      // Upstream messages can name tables/columns — log them, never relay them.
      const error = new Error(`Upstream error ${response.status}`);
      error.status = response.status >= 500 ? 502 : 400;
      error.upstream = data?.message || data?.error || null;
      throw error;
    }
    return data;
  }
}
