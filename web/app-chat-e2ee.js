(function () {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const keyCache = new Map();
  const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

  async function identity(supa, userId) {
    const storageKey = 'duvela.e2ee.private.' + userId;
    let privateJwk = null;
    try { privateJwk = JSON.parse(localStorage.getItem(storageKey)); } catch (_) {}
    let privateKey;
    let publicJwk;
    if (!privateJwk) {
      const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
      privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
      publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      localStorage.setItem(storageKey, JSON.stringify(privateJwk));
      privateKey = pair.privateKey;
    } else {
      privateKey = await crypto.subtle.importKey('jwk', privateJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
      const existing = await supa.from('chat_e2ee_identities').select('public_key').eq('user_id', userId).maybeSingle();
      publicJwk = existing.data && existing.data.public_key;
      if (!publicJwk) publicJwk = { kty: privateJwk.kty, n: privateJwk.n, e: privateJwk.e, alg: 'RSA-OAEP-256', ext: true, key_ops: ['encrypt'] };
    }
    if (publicJwk) await supa.from('chat_e2ee_identities').upsert({ user_id: userId, public_key: publicJwk, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return { privateKey };
  }

  async function conversationKey(supa, userId, conversationId) {
    if (keyCache.has(conversationId)) return keyCache.get(conversationId);
    const me = await identity(supa, userId);
    const own = await supa.from('chat_e2ee_envelopes').select('encrypted_key').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle();
    if (own.data) {
      const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, me.privateKey, unb64(own.data.encrypted_key));
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      keyCache.set(conversationId, key);
      return key;
    }
    const membersResult = await supa.from('chat_participants').select('user_id').eq('conversation_id', conversationId);
    const memberIds = (membersResult.data || []).map((row) => row.user_id).sort();
    const claim = await supa.rpc('claim_chat_e2ee_initialization', { target_conversation_id: conversationId });
    if (claim.error) throw claim.error;
    if (!memberIds.length || claim.data !== userId) throw new Error('Encryption is being initialized by another participant. Please try again shortly.');
    const identities = await supa.from('chat_e2ee_identities').select('user_id,public_key').in('user_id', memberIds);
    if ((identities.data || []).length !== memberIds.length) throw new Error('Every participant must open the updated chat once before encrypted messages can be sent.');
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const raw = await crypto.subtle.exportKey('raw', key);
    const rows = [];
    for (const item of identities.data) {
      const publicKey = await crypto.subtle.importKey('jwk', item.public_key, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
      rows.push({ conversation_id: conversationId, user_id: item.user_id, encrypted_key: b64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw)) });
    }
    const saved = await supa.from('chat_e2ee_envelopes').insert(rows);
    if (saved.error) throw saved.error;
    keyCache.set(conversationId, key);
    return key;
  }

  async function encryptText(supa, userId, conversationId, plain) {
    const key = await conversationKey(supa, userId, conversationId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
    return 'e2ee:v1:' + b64(iv) + ':' + b64(cipher);
  }

  async function decryptText(supa, userId, conversationId, value) {
    if (!String(value || '').startsWith('e2ee:v1:')) return value || '';
    const parts = value.split(':');
    const key = await conversationKey(supa, userId, conversationId);
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parts[2]) }, key, unb64(parts[3])));
  }

  async function encryptBytes(supa, userId, conversationId, bytes) {
    const key = await conversationKey(supa, userId, conversationId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    return { cipher, iv: b64(iv) };
  }

  async function decryptBytes(supa, userId, conversationId, cipher, iv) {
    const key = await conversationKey(supa, userId, conversationId);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, cipher);
  }

  window.DuvelaChatE2EE = { identity, conversationKey, encryptText, decryptText, encryptBytes, decryptBytes };
})();
