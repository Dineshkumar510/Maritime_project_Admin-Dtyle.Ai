const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');

const pool            = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET     = process.env.JWT_SECRET;
const ACCESS_TTL     = process.env.ACCESS_TOKEN_TTL   || '12h';
const REFRESH_DAYS   = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
const NEXT_APP_URL   = process.env.NEXT_APP_URL  || 'https://faq-present-trim-highways.trycloudflare.com';
const ANGULAR_URL    = process.env.ANGULAR_APP_URL || 'http://localhost:4200';
const IS_PROD        = process.env.NODE_ENV === 'production';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the JWT payload. Fields deliberately mirror Fastify's token structure
 *  so that request.jwtVerify() on the Fastify side sees expected keys. */
function buildPayload(user) {
  return {
    id                   : user.id,
    code                 : user.username,
    name                 : user.username,
    emailid              : user.email,
    role                 : user.role,           // human-readable (admin, operator …)
    roleId               : user.role_id,        // numeric — matches Fastify hasPermission()
    orgId                : user.org_id,         // numeric — matches Fastify queries
    is_all_entity_access : !!user.is_all_entity_access,
    source               : 'sso',              // lets Fastify identify SSO tokens
  };
}

function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function setCookies(res, accessToken, refreshToken) {
  const base = { httpOnly: true, secure: IS_PROD, path: '/' };

  res.cookie('auth_token', accessToken, {
    ...base,
    sameSite: IS_PROD ? 'None' : 'Lax',
    maxAge  : 12 * 60 * 60 * 1000,            // 12 h
  });

  if (refreshToken) {
    res.cookie('refresh_token', refreshToken, {
      ...base,
      sameSite: IS_PROD ? 'None' : 'Lax',
      maxAge  : REFRESH_DAYS * 24 * 60 * 60 * 1000,
    });
  }
}

function clearCookies(res) {
  const opts = { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'None' : 'Lax', path: '/' };
  res.clearCookie('auth_token',    opts);
  res.clearCookie('refresh_token', opts);
}

async function saveRefreshToken(adminId, rawToken) {
  const hash      = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await pool.execute(
    'INSERT INTO refresh_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [adminId, hash, expiresAt]
  );
  return hash;
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    const [rows] = await pool.execute(
      `SELECT * FROM maritime_admin
       WHERE (username = ? OR email = ?) AND is_active = 1
       LIMIT 1`,
      [username.trim(), username.trim()]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.is_locked)
      return res.status(401).json({ error: 'Account locked — contact your administrator' });

    // ── Password check ────────────────────────────────────────────────────────
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const cnt    = (user.wrong_password_cnt || 0) + 1;
      const locked = cnt >= 5;
      await pool.execute(
        'UPDATE maritime_admin SET wrong_password_cnt = ?, is_locked = ? WHERE id = ?',
        [cnt, locked ? 1 : 0, user.id]
      );
      return res.status(401).json({
        error: locked
          ? 'Account locked after too many failed attempts'
          : `Invalid credentials (${5 - cnt} attempt(s) remaining)`,
      });
    }

    // ── Success: reset counters, record login time ─────────────────────────────
    await pool.execute(
      'UPDATE maritime_admin SET wrong_password_cnt = 0, is_locked = 0, last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // ── Issue tokens ──────────────────────────────────────────────────────────
    const payload      = buildPayload(user);
    const accessToken  = signAccess(payload);
    const rawRefresh   = uuidv4();
    await saveRefreshToken(user.id, rawRefresh);

    setCookies(res, accessToken, rawRefresh);

    // SSO deep-link — Next.js will verify this token and create its own session
    const ssoUrl = `${NEXT_APP_URL}/api/sso?token=${encodeURIComponent(accessToken)}&redirectTo=/management-dashboard`;

    return res.json({
      success : true,
      ssoUrl,                          // Angular redirects the browser here
      token   : accessToken,           // available for header-based calls
      user    : { id: user.id, name: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[/login]', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const rawRefresh = req.cookies?.refresh_token;
  if (rawRefresh) {
    const hash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    await pool.execute(
      'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?',
      [hash]
    ).catch(() => {});
  }
  clearCookies(res);
  return res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/refresh   — swap refresh cookie → new access token
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const rawRefresh = req.cookies?.refresh_token;
  if (!rawRefresh) return res.status(401).json({ error: 'No refresh token' });

  const hash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

  const [rows] = await pool.execute(
    `SELECT rt.*, ma.*
     FROM refresh_tokens rt
     JOIN maritime_admin ma ON ma.id = rt.admin_id
     WHERE rt.token_hash = ?
       AND rt.revoked = 0
       AND rt.expires_at > NOW()
       AND ma.is_active = 1
       AND ma.is_locked = 0
     LIMIT 1`,
    [hash]
  );

  if (!rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  const user        = rows[0];
  const accessToken = signAccess(buildPayload(user));
  setCookies(res, accessToken, null);   // keep existing refresh cookie

  return res.json({ success: true, token: accessToken });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/validate-token  — used by Next.js SSO to verify the incoming JWT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/validate-token', (req, res) => {
  const token =
    req.cookies?.auth_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.query.token;

  if (!token) return res.status(401).json({ valid: false, error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ valid: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/me  — return current user info (protected)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/logout-all  — global logout: revoke ALL refresh tokens for user
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout-all', requireAuth, async (req, res) => {
  await pool.execute(
    'UPDATE refresh_tokens SET revoked = 1 WHERE admin_id = ?',
    [req.user.id]
  ).catch(() => {});
  clearCookies(res);
  return res.json({ success: true });
});

module.exports = router;
