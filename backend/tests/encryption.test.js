'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function loadWith(cfg) {
  const configPath = require.resolve('../app/config');
  const encPath = require.resolve('../app/utils/encryption');
  delete require.cache[encPath];
  require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: cfg };
  return require('../app/utils/encryption');
}

test('encrypt/decrypt round-trips, including multibyte text', () => {
  const { encrypt, decrypt } = loadWith({ encryptionSecret: 's3cret', nodeEnv: 'test' });
  const text = 'sk-test-ключ-密钥-🔑'.repeat(5);
  const { encrypted_api_key, iv, auth_tag } = encrypt(text);
  assert.notEqual(encrypted_api_key, text);
  assert.equal(decrypt(encrypted_api_key, iv, auth_tag), text);
});

test('each encryption uses a fresh IV', () => {
  const { encrypt } = loadWith({ encryptionSecret: 's3cret', nodeEnv: 'test' });
  assert.notEqual(encrypt('same').iv, encrypt('same').iv);
});

test('decrypt fails with a different secret', () => {
  const a = loadWith({ encryptionSecret: 'one', nodeEnv: 'test' });
  const out = a.encrypt('payload');
  const b = loadWith({ encryptionSecret: 'two', nodeEnv: 'test' });
  assert.throws(() => b.decrypt(out.encrypted_api_key, out.iv, out.auth_tag));
});

test('missing secret throws in production', () => {
  const { encrypt } = loadWith({ encryptionSecret: undefined, nodeEnv: 'production' });
  assert.throws(() => encrypt('x'), /ENCRYPTION_SECRET/);
});

test('missing secret still works in development', () => {
  const { encrypt, decrypt } = loadWith({ encryptionSecret: undefined, nodeEnv: 'development' });
  const o = encrypt('x');
  assert.equal(decrypt(o.encrypted_api_key, o.iv, o.auth_tag), 'x');
});
