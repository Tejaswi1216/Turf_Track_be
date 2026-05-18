import { supabaseAdmin, supabaseAnon, supabaseUrl, supabaseServiceKey } from '../config/database.js';

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (page <= 100) {
    const res = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    const batch = Array.isArray(res?.data?.users)
      ? res.data.users
      : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.users)
          ? res.users
          : [];

    if (!Array.isArray(batch) || batch.length === 0) break;
    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

/**
 * Get user from authorization header
 */
export async function getUserFromAuthHeader(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  console.log('[getUserFromAuthHeader] Authorization header:', authHeader);
  console.log('[getUserFromAuthHeader] Extracted token:', token);
  
  if (!token) {
    console.error('[getUserFromAuthHeader] Missing token');
    return { error: 'Missing token' };
  }
  
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error) {
    console.error('[getUserFromAuthHeader] supabaseAnon.auth.getUser error:', error);
    return { error: 'Invalid token' };
  }
  
  const user = data.user;
  
  // Get role from profiles table for more accurate role checking
  let userRole = 'user'; // default
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile && profile.role) {
      userRole = profile.role;
    } else {
      // Fallback to user metadata
      userRole = (user?.user_metadata?.role === 'admin') ? 'admin' : 'user';
    }
  } catch (e) {
    console.error('[getUserFromAuthHeader] Error fetching profile role:', e);
    // Fallback to user metadata
    userRole = (user?.user_metadata?.role === 'admin') ? 'admin' : 'user';
  }
  
  return {
    user: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || '',
      role: userRole,
    },
    token,
  };
}

/**
 * Check if an email exists using GoTrue Admin REST API
 */
export async function emailExists(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return false;
  try {
    // First check the application database, where profile rows are created for confirmed users.
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (profileRow) {
      return true;
    }

    // Prefer Supabase Admin SDK and page through the full user list so duplicate checks do not miss older accounts.
    try {
      if (supabaseAdmin && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.listUsers === 'function') {
        const users = await listAllUsers();
        if (Array.isArray(users) && users.length > 0) {
          return users.some(u => (u.email || '').toLowerCase() === email);
        }
      }
    } catch (sdkErr) {
      console.error('[emailExists] Supabase admin SDK listUsers error:', sdkErr);
      // continue to fallback approaches
    }

    // Fallback: use global fetch to call the Admin REST endpoint if available
    if (typeof fetch === 'function') {
      const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });
      if (!resp.ok) {
        throw new Error(`[emailExists] Admin REST error status: ${resp.status}`);
      } else {
        const json = await resp.json().catch(() => ({ users: [] }));
        const users = Array.isArray(json?.users) ? json.users : (Array.isArray(json) ? json : []);
        return users.some(u => (u.email || '').toLowerCase() === email);
      }
    } else {
      console.warn('[emailExists] global fetch is not available in this Node runtime. Falling back to SDK-only approach');
    }

    // As a last-resort, try to iterate listUsers with pagination (if SDK supports parameters)
    try {
      if (supabaseAdmin && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.listUsers === 'function') {
        const users = await listAllUsers();
        return Array.isArray(users) && users.some(u => (u.email || '').toLowerCase() === email);
      }
    } catch (e) {
      console.error('[emailExists] fallback SDK paginated listUsers error:', e);
    }

    throw new Error('[emailExists] Unable to verify email existence');
  } catch (err) {
    console.error('[emailExists] error:', err);
    throw err;
  }
}

/**
 * Get user object by email via Admin REST API
 */
export async function getUserByEmail(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return null;
  try {
    // Prefer SDK
    try {
      if (supabaseAdmin && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.listUsers === 'function') {
        const users = await listAllUsers();
        const user = Array.isArray(users) ? users.find(u => (u.email || '').toLowerCase() === email) : null;
        if (user) return user;
      }
    } catch (sdkErr) {
      console.error('[getUserByEmail] Supabase admin SDK listUsers error:', sdkErr);
    }

    // Fallback to REST admin endpoint if fetch available
    if (typeof fetch === 'function') {
      const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });
      if (!resp.ok) {
        throw new Error(`[getUserByEmail] Admin REST error status: ${resp.status}`);
      }
      const json = await resp.json().catch(() => ({ users: [] }));
      const users = Array.isArray(json?.users) ? json.users : (Array.isArray(json) ? json : []);
      const user = users.find(u => (u.email || '').toLowerCase() === email);
      return user || null;
    }

    // Try a paginated SDK call as a last option
    try {
      if (supabaseAdmin && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.listUsers === 'function') {
        const users = await listAllUsers();
        const user = Array.isArray(users) ? users.find(u => (u.email || '').toLowerCase() === email) : null;
        return user || null;
      }
    } catch (e) {
      console.error('[getUserByEmail] fallback SDK paginated listUsers error:', e);
    }

    throw new Error('[getUserByEmail] Unable to verify user existence');
  } catch (err) {
    console.error('[getUserByEmail] error:', err);
    throw err;
  }
}
