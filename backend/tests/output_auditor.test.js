'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function loadAuditor(inferImpl) {
  const infPath = require.resolve('../app/pipeline/inference_engine');
  const audPath = require.resolve('../app/pipeline/output_auditor');
  delete require.cache[audPath];
  require.cache[infPath] = { id: infPath, filename: infPath, loaded: true, exports: { infer: inferImpl } };
  return require('../app/pipeline/output_auditor');
}

const args = { originalResponse: 'resp', inputText: 'in', decisionPoints: ['age'], modelId: 'm' };

test('parses plain JSON replies', async () => {
  const { auditOutput } = loadAuditor(async () => ({
    text: '{"output_bias_score": 42, "confidence_level": "MEDIUM", "reasoning": "ok"}',
  }));
  assert.deepEqual(await auditOutput(args), { outputBiasScore: 42, confidenceLevel: 'MEDIUM', reasoning: 'ok' });
});

test('parses fenced JSON surrounded by prose', async () => {
  const { auditOutput } = loadAuditor(async () => ({
    text: 'Here you go:\n```json\n{"output_bias_score": 80, "reasoning": "r"}\n```\nHope that helps!',
  }));
  const r = await auditOutput(args);
  assert.equal(r.outputBiasScore, 80);
  assert.equal(r.confidenceLevel, 'HIGH'); // derived from score when missing
});

test('clamps out-of-range scores', async () => {
  const { auditOutput } = loadAuditor(async () => ({ text: '{"output_bias_score": 250}' }));
  assert.equal((await auditOutput(args)).outputBiasScore, 100);
});

test('returns the failure sentinel when the reply is not JSON', async () => {
  const { auditOutput } = loadAuditor(async () => ({ text: 'no json here' }));
  assert.deepEqual(await auditOutput(args), { outputBiasScore: -1, confidenceLevel: 'UNKNOWN', reasoning: 'Audit failed' });
});

test('tolerates missing decisionPoints', async () => {
  let seen;
  const { auditOutput } = loadAuditor(async ({ prompt }) => { seen = prompt; return { text: '{"output_bias_score": 5}' }; });
  const r = await auditOutput({ ...args, decisionPoints: undefined });
  assert.equal(r.outputBiasScore, 5);
  assert.match(seen, /DETECTED INPUT SIGNALS:\nnone/);
});
