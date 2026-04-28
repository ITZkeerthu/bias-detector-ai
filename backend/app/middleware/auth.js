'use strict';
/**
 * Auth middleware — verifies Supabase JWT from Authorization header.
 * Attaches req.user = { id, email, role } on success.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Anon client used only for token verification
const anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: { persistSession: false },
});

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await anonClient.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }

  // Fetch application role from users table
  const supabase = require('../db/supabase_client');
  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profile && !profile.is_active) {
    return res.status(403).json({ error: 'Account disabled', code: 'FORBIDDEN' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: profile?.role || 'analyst',
  };
  next();
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
