const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { decrypt } = require("../utils/crypto");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "12h";
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
const NEXT_APP_URL =
  process.env.NEXT_APP_URL ||
  "https://faq-present-trim-highways.trycloudflare.com";
const ANGULAR_URL = process.env.ANGULAR_APP_URL || "http://localhost:4200";
const IS_PROD = process.env.NODE_ENV === "production";

function buildPayload(user) {
  return {
    id: user.id,
    code: user.username,
    name: user.username,
    emailid: user.email,
    role: user.role,
    roleId: user.role_id,
    orgId: user.org_id,
    is_all_entity_access: !!user.is_all_entity_access,
    source: "sso",
  };
}

function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function setCookies(res, accessToken, refreshToken) {
  const base = { httpOnly: true, secure: IS_PROD, path: "/" };

  res.cookie("auth_token", accessToken, {
    ...base,
    sameSite: IS_PROD ? "None" : "Lax",
    maxAge: 12 * 60 * 60 * 1000,
  });

  if (refreshToken) {
    res.cookie("refresh_token", refreshToken, {
      ...base,
      sameSite: IS_PROD ? "None" : "Lax",
      maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    });
  }
}

function clearCookies(res) {
  const opts = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "None" : "Lax",
    path: "/",
  };
  res.clearCookie("auth_token", opts);
  res.clearCookie("refresh_token", opts);
}

async function saveRefreshToken(adminId, rawToken) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await pool.execute(
    "INSERT INTO refresh_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [adminId, hash, expiresAt],
  );
  return hash;
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ error: "Username and password are required" });

    const [rows] = await pool.execute(
      `SELECT * FROM maritime_admin
       WHERE (username = ? OR email = ?) AND is_active = 1
       LIMIT 1`,
      [username.trim(), username.trim()],
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (user.is_locked)
      return res
        .status(401)
        .json({ error: "Account locked — contact your administrator" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const cnt = (user.wrong_password_cnt || 0) + 1;
      const locked = cnt >= 5;
      await pool.execute(
        "UPDATE maritime_admin SET wrong_password_cnt = ?, is_locked = ? WHERE id = ?",
        [cnt, locked ? 1 : 0, user.id],
      );
      return res.status(401).json({
        error: locked
          ? "Account locked after too many failed attempts"
          : `Invalid credentials (${5 - cnt} attempt(s) remaining)`,
      });
    }
    await pool.execute(
      "UPDATE maritime_admin SET wrong_password_cnt = 0, is_locked = 0, last_login = NOW() WHERE id = ?",
      [user.id],
    );

    const payload = buildPayload(user);
    const accessToken = signAccess(payload);
    const rawRefresh = uuidv4();
    await saveRefreshToken(user.id, rawRefresh);

    setCookies(res, accessToken, rawRefresh);

    const ssoUrl = `${NEXT_APP_URL}/api/sso?token=${encodeURIComponent(accessToken)}&redirectTo=/management-dashboard`;

    return res.json({
      success: true,
      ssoUrl,
      token: accessToken,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[/login]", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", async (req, res) => {
  const rawRefresh = req.cookies?.refresh_token;
  if (rawRefresh) {
    const hash = crypto.createHash("sha256").update(rawRefresh).digest("hex");
    await pool
      .execute("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [
        hash,
      ])
      .catch(() => {});
  }
  clearCookies(res);
  return res.json({ success: true });
});

router.post("/refresh", async (req, res) => {
  const rawRefresh = req.cookies?.refresh_token;
  if (!rawRefresh) return res.status(401).json({ error: "No refresh token" });

  const hash = crypto.createHash("sha256").update(rawRefresh).digest("hex");

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
    [hash],
  );

  if (!rows[0])
    return res.status(401).json({ error: "Invalid or expired refresh token" });

  const user = rows[0];
  const accessToken = signAccess(buildPayload(user));
  setCookies(res, accessToken, null);

  return res.json({ success: true, token: accessToken });
});

router.get("/validate-token", (req, res) => {
  const token =
    req.cookies?.auth_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    req.query.token;

  if (!token)
    return res.status(401).json({ valid: false, error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ valid: false, error: err.message });
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.post("/logout-all", requireAuth, async (req, res) => {
  await pool
    .execute("UPDATE refresh_tokens SET revoked = 1 WHERE admin_id = ?", [
      req.user.id,
    ])
    .catch(() => {});
  clearCookies(res);
  return res.json({ success: true });
});

router.post("/generate-token", requireAuth, async (req, res) => {
  try {
    const { shipId } = req.body;
    if (!shipId) return res.status(400).json({ error: "shipId is required" });

    const [rows] = await pool.execute(
      "SELECT * FROM ships WHERE id = ? LIMIT 1",
      [shipId],
    );
    const ship = rows[0];
    if (!ship) return res.status(404).json({ error: "Ship not found" });
    const ssoPayload = { ...req.user, shipId: ship.id, source: "sso" };
    delete ssoPayload.exp;
    delete ssoPayload.iat;

    const ssoToken = jwt.sign(ssoPayload, JWT_SECRET, { expiresIn: "5m" });

    // 🔐 Decrypt the stored redirect_url before using it — it is AES-encrypted at rest
    const plainRedirectUrl = decrypt(ship.redirect_url);

    // Extract dynamic Host/Origin so each ship correctly targets its own Cloudflare tunnel
    let targetOrigin = NEXT_APP_URL;
    let targetPath = plainRedirectUrl;

    if (plainRedirectUrl.startsWith("http")) {
      const parsedUrl = new URL(plainRedirectUrl);
      targetOrigin = parsedUrl.origin;
      targetPath = parsedUrl.pathname + parsedUrl.search;
    }

    const ssoUrl = `${targetOrigin}/api/sso?token=${encodeURIComponent(ssoToken)}&redirectTo=${encodeURIComponent(targetPath)}`;

    return res.json({ success: true, ssoUrl, token: ssoToken });
  } catch (err) {
    console.error("[/generate-token]", err);
    return res.status(500).json({ error: "Failed to generate token" });
  }
});

module.exports = router;