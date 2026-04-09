const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// ── Upload dir ───────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req,  file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * Decrypt redirect_url on every ship row returned from the DB.
 * The decrypt() helper is safe to call on already-plaintext values,
 * so rows that haven't been migrated yet will pass through unchanged.
 */
function decryptShip(ship) {
  return { ...ship, redirect_url: decrypt(ship.redirect_url) };
}

// ── GET /api/ships ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ships ORDER BY created_at DESC');
    res.json({ ships: rows.map(decryptShip) });
  } catch (err) {
    console.error('Error fetching ships:', err);
    res.status(500).json({ error: 'Failed to fetch ships' });
  }
});

// ── POST /api/ships ──────────────────────────────────────────────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, redirect_url, description, status } = req.body;
    let image_url = req.body.image_url || '';

    if (req.file) {
      image_url = `http://localhost:${process.env.PORT || 4000}/uploads/${req.file.filename}`;
    }

    const shipStatus       = status || 'active';
    const encrypted_url    = encrypt(redirect_url);   

    const [result] = await pool.execute(
      'INSERT INTO ships (name, image_url, redirect_url, description, status) VALUES (?, ?, ?, ?, ?)',
      [name, image_url, encrypted_url, description || null, shipStatus],
    );

    const [rows] = await pool.execute('SELECT * FROM ships WHERE id = ?', [result.insertId]);
    res.json({ success: true, ship: decryptShip(rows[0]) });
  } catch (err) {
    console.error('Error adding ship:', err);
    res.status(500).json({ error: 'Failed to add ship' });
  }
});

// ── PUT /api/ships/:id ───────────────────────────────────────────────────────
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const shipId = req.params.id;
    const { name, redirect_url, description, status } = req.body;

    const [existing] = await pool.execute('SELECT * FROM ships WHERE id = ?', [shipId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Ship not found' });
    }

    const existingShip = existing[0];
    let image_url      = existingShip.image_url;

    // Handle image replacement
    if (req.file) {
      image_url = `http://localhost:${process.env.PORT || 4000}/uploads/${req.file.filename}`;
      _deleteLocalImage(existingShip.image_url);
    } else if (req.body.image_url !== undefined) {
      if (req.body.image_url !== existingShip.image_url) _deleteLocalImage(existingShip.image_url);
      image_url = req.body.image_url;
    }

    const shipStatus    = status || existingShip.status;
    const encrypted_url = encrypt(redirect_url);     

    await pool.execute(
      'UPDATE ships SET name = ?, image_url = ?, redirect_url = ?, description = ?, status = ? WHERE id = ?',
      [name, image_url, encrypted_url, description || null, shipStatus, shipId],
    );

    const [updated] = await pool.execute('SELECT * FROM ships WHERE id = ?', [shipId]);
    res.json({ success: true, ship: decryptShip(updated[0]) });
  } catch (err) {
    console.error('Error updating ship:', err);
    res.status(500).json({ success: false, error: 'Failed to update ship', message: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [ships] = await pool.execute('SELECT * FROM ships WHERE id = ?', [req.params.id]);
    if (ships.length > 0) _deleteLocalImage(ships[0].image_url);

    await pool.execute('DELETE FROM ships WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ship:', err);
    res.status(500).json({ error: 'Failed to delete ship' });
  }
});

function _deleteLocalImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes('/uploads/')) return;
  const filename = imageUrl.split('/uploads/')[1];
  const filepath = path.join(uploadDir, filename);
  if (fs.existsSync(filepath)) {
    try { fs.unlinkSync(filepath); } catch (e) { console.error('Error deleting image:', e); }
  }
}

module.exports = router;
