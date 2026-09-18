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
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Supabase ${response.status}`);
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return data;
  }
}
