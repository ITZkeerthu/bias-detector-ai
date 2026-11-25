'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Stub dotenv so the test needs no installed dependencies (CI only runs `npm test`).
function stubDotenv() {
  const id = require.resolve('../app/config') + '#dotenv-stub';
  const Module = require('node:module');
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    return request === 'dotenv' ? id : orig.call(this, request, ...rest);
  };
  require.cache[id] = { id, filename: id, loaded: true, exports: { config() {} } };
}
stubDotenv();

function loadConfig(env) {
  const saved = { ...process.env };
  for (const k of ['PORT', 'BIAS_THRESHOLD']) delete process.env[k];
  Object.assign(process.env, env);
  const p = require.resolve('../app/config');
  delete require.cache[p];
  try { return require('../app/config'); } finally {
    process.env = saved;
  }
}

test('uses defaults when numeric env vars are unset', () => {
  const c = loadConfig({});
  assert.equal(c.port, 3000);
  assert.equal(c.biasThreshold, 30);
});

test('reads valid numeric env vars', () => {
  const c = loadConfig({ PORT: '8080', BIAS_THRESHOLD: '45' });
  assert.equal(c.port, 8080);
  assert.equal(c.biasThreshold, 45);
});

test('falls back to the default (never NaN) for invalid values', () => {
  const c = loadConfig({ PORT: 'abc', BIAS_THRESHOLD: 'high' });
  assert.equal(c.port, 3000);
  assert.equal(c.biasThreshold, 30);
});
