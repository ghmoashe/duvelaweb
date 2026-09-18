export class RedisCache {
  constructor({ redisRestUrl, redisRestToken }) {
    this.redisRestUrl = redisRestUrl;
    this.redisRestToken = redisRestToken;
    this.enabled = Boolean(redisRestUrl && redisRestToken);
    this.memory = new Map();
  }

  async command(command) {
    if (!this.enabled) return { disabled: true, result: null };
    const response = await fetch(this.redisRestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.redisRestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.error) {
      throw new Error(String(json?.error || `Redis ${response.status}`));
    }
    return { disabled: false, result: json?.result ?? null };
  }

  async get(key) {
    const memoryValue = this.getMemory(key);
    if (memoryValue) return { state: 'hit', store: 'memory', value: memoryValue };

    const result = await this.command(['GET', key]);
    if (result.disabled) return { state: 'miss', store: 'memory', value: null };
    if (!result.result) return { state: 'miss', store: 'redis', value: null };
    return { state: 'hit', store: 'redis', value: JSON.parse(String(result.result)) };
  }

  async set(key, value, ttlSeconds) {
    this.setMemory(key, value, ttlSeconds);
    if (this.enabled) {
      await this.command(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]);
    }
  }

  async selfTest() {
    if (!this.enabled) return { configured: false, ok: false };
    const key = `duvela:backend:health:${Date.now()}`;
    const value = `ok:${Date.now()}`;
    await this.command(['SET', key, value, 'EX', 30]);
    const result = await this.command(['GET', key]);
    return { configured: true, ok: result.result === value };
  }

  getMemory(key) {
    const cached = this.memory.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return cached.value;
  }

  setMemory(key, value, ttlSeconds) {
    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (this.memory.size <= 1000) return;

    const now = Date.now();
    for (const [entryKey, entry] of this.memory.entries()) {
      if (entry.expiresAt <= now) this.memory.delete(entryKey);
    }
  }
}
