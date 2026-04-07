const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Make sure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// GET /api/ships
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ships ORDER BY created_at DESC');
    res.json({ ships: rows });
  } catch (err) {
    console.error('Error fetching ships:', err);
    res.status(500).json({ error: 'Failed to fetch ships' });
  }
});

// POST /api/ships
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, redirect_url, description, status } = req.body;
    let image_url = req.body.image_url || '';

    if (req.file) {
      image_url = `http://localhost:${process.env.PORT || 4000}/uploads/${req.file.filename}`;
    }
    
    const shipStatus = status || 'active';
    
    // Based on requested schema plus description and status
    const [result] = await pool.execute(
      'INSERT INTO ships (name, image_url, redirect_url, description, status) VALUES (?, ?, ?, ?, ?)',
      [name, image_url, redirect_url, description || null, shipStatus]
    );

    const newShipId = result.insertId;
    
    const [rows] = await pool.execute('SELECT * FROM ships WHERE id = ?', [newShipId]);

    res.json({ success: true, ship: rows[0] });
  } catch (err) {
    console.error('Error adding ship:', err);
    res.status(500).json({ error: 'Failed to add ship' });
  }
});

// DELETE /api/ships/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const shipId = req.params.id;
    await pool.execute('DELETE FROM ships WHERE id = ?', [shipId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ship:', err);
    res.status(500).json({ error: 'Failed to delete ship' });
  }
});

module.exports = router;
