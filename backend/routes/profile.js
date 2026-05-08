const router  = require("express").Router();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const pool    = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

// ── Upload config ────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (req,  file, cb) => {
    // Prefix files with the user id and a "kind" so they're easy to clean up.
    const uid  = req.user?.id || "anon";
    const kind = req.params.kind || "profile";
    const safe = `${uid}-${kind}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard cap
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Unsupported file type. Use JPG, PNG, WEBP, GIF or SVG."));
    }
    cb(null, true);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function publicUrl(req, filename) {
  // Prefer the explicit env value so behind a tunnel/proxy the URL stays right.
  const base = process.env.PUBLIC_BACKEND_URL ||
               `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${filename}`;
}

async function getCurrentProfile(adminId) {
  const [rows] = await pool.execute(
    `SELECT id, username, display_name, email, role,
            profile_photo_url, org_logo_url, org_name
       FROM maritime_admin
      WHERE id = ?
      LIMIT 1`,
    [adminId],
  );
  if (!rows[0]) return null;
  const u = rows[0];
  return {
    id:                u.id,
    username:          u.username,
    name:              u.display_name || u.username,
    email:             u.email,
    role:              u.role,
    profile_photo_url: u.profile_photo_url || null,
    org_logo_url:      u.org_logo_url || null,
    org_name:          u.org_name || null,
  };
}

function tryDeleteUpload(url) {
  // Only delete files that look like they live under /uploads. Anything else
  // (CDN URL, external link) is left alone.
  if (!url || typeof url !== "string") return;
  const m = url.match(/\/uploads\/([^/?#]+)$/);
  if (!m) return;
  const fp = path.join(uploadDir, m[1]);
  fs.unlink(fp, () => {});
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/profile/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const profile = await getCurrentProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true, profile });
  } catch (err) {
    console.error("[GET /profile/me]", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// PUT /api/profile  { display_name?, org_name? }
router.put("/", requireAuth, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.display_name === "string") {
      const v = req.body.display_name.trim();
      if (!v) return res.status(400).json({ error: "Display name cannot be empty" });
      if (v.length > 255) return res.status(400).json({ error: "Display name too long" });
      updates.display_name = v;
    }
    if (typeof req.body.org_name === "string") {
      const v = req.body.org_name.trim();
      if (v.length > 255) return res.status(400).json({ error: "Organization name too long" });
      updates.org_name = v || null;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const fields = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    await pool.execute(
      `UPDATE maritime_admin SET ${fields} WHERE id = ?`,
      [...values, req.user.id],
    );

    const profile = await getCurrentProfile(req.user.id);
    return res.json({ success: true, profile });
  } catch (err) {
    console.error("[PUT /profile]", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * Helper that produces both POST /photo and POST /logo handlers without
 * duplicating the multer + DB plumbing.
 */
function makeImageUploadHandler(column, paramKind) {
  return [
    requireAuth,
    (req, _res, next) => { req.params.kind = paramKind; next(); },
    upload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        // Clean up the previous file if it was hosted locally.
        const [old] = await pool.execute(
          `SELECT \`${column}\` AS url FROM maritime_admin WHERE id = ?`,
          [req.user.id],
        );
        if (old[0]?.url) tryDeleteUpload(old[0].url);

        const url = publicUrl(req, req.file.filename);
        await pool.execute(
          `UPDATE maritime_admin SET \`${column}\` = ? WHERE id = ?`,
          [url, req.user.id],
        );

        const profile = await getCurrentProfile(req.user.id);
        return res.json({ success: true, profile });
      } catch (err) {
        // multer's MulterError carries a useful code; surface filesize errors clearly.
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "Image too large (max 10 MB)" });
        }
        console.error(`[POST /profile/${paramKind}]`, err);
        return res.status(500).json({ error: err.message || "Upload failed" });
      }
    },
  ];
}

router.post("/photo", ...makeImageUploadHandler("profile_photo_url", "photo"));
router.post("/logo",  ...makeImageUploadHandler("org_logo_url","logo"));

// DELETE /api/profile/photo  &  DELETE /api/profile/logo
function makeImageDeleteHandler(column) {
  return [
    requireAuth,
    async (req, res) => {
      try {
        const [old] = await pool.execute(
          `SELECT \`${column}\` AS url FROM maritime_admin WHERE id = ?`,
          [req.user.id],
        );
        if (old[0]?.url) tryDeleteUpload(old[0].url);

        await pool.execute(
          `UPDATE maritime_admin SET \`${column}\` = NULL WHERE id = ?`,
          [req.user.id],
        );

        const profile = await getCurrentProfile(req.user.id);
        return res.json({ success: true, profile });
      } catch (err) {
        console.error(`[DELETE ${column}]`, err);
        return res.status(500).json({ error: "Failed to remove image" });
      }
    },
  ];
}

router.delete("/photo", ...makeImageDeleteHandler("profile_photo_url"));
router.delete("/logo",  ...makeImageDeleteHandler("org_logo_url"));

module.exports = router;
module.exports.getCurrentProfile = getCurrentProfile;
