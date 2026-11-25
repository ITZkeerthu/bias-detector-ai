'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

/** Parse an integer env var, falling back to the default when unset or not a number. */
function intEnv(name, fallback) {
  const n = parseInt(process.env[name], 10);
  if (Number.isNaN(n)) {
    if (process.env[name] !== undefined && process.env[name] !== '') {
      console.warn(`[config] ${name} is not a number; using default ${fallback}`);
    }
    return fallback;
  }
  return n;
}

module.exports = {
  port: intEnv('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  llm: {
    nvidiaApiKey: process.env.NVIDIA_API_KEY,
    githubApiKey: process.env.GITHUB_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
  },

  encryptionSecret: process.env.ENCRYPTION_SECRET,
  biasDetectorUrl: process.env.BIAS_DETECTOR_URL || 'http://localhost:5001',
  biasThreshold: intEnv('BIAS_THRESHOLD', 30),
  allowForceBias: process.env.ALLOW_FORCE_BIAS === 'true',
};
