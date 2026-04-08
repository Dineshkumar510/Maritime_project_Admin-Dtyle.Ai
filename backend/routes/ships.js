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

// PUT /api/ships/:id - Update a ship
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const shipId = req.params.id;
    const { name, redirect_url, description, status } = req.body;

    // Check if ship exists
    const [existingShips] = await pool.execute('SELECT * FROM ships WHERE id = ?', [shipId]);
    
    if (existingShips.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ship not found' 
      });
    }

    const existingShip = existingShips[0];
    let image_url = existingShip.image_url; // Keep existing image by default

    // Handle new image upload
    if (req.file) {
      image_url = `http://localhost:${process.env.PORT || 4000}/uploads/${req.file.filename}`;
      
      // Delete old uploaded image if it exists and is a local file
      if (existingShip.image_url && existingShip.image_url.includes('/uploads/')) {
        const oldFilename = existingShip.image_url.split('/uploads/')[1];
        const oldFilePath = path.join(uploadDir, oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (unlinkErr) {
            console.error('Error deleting old image:', unlinkErr);
          }
        }
      }
    } else if (req.body.image_url !== undefined) {
      // Use provided image_url (external URL or cleared)
      image_url = req.body.image_url;
      
      // If switching to external URL, delete old local image
      if (req.body.image_url !== existingShip.image_url && 
          existingShip.image_url && 
          existingShip.image_url.includes('/uploads/')) {
        const oldFilename = existingShip.image_url.split('/uploads/')[1];
        const oldFilePath = path.join(uploadDir, oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (unlinkErr) {
            console.error('Error deleting old image:', unlinkErr);
          }
        }
      }
    }

    const shipStatus = status || existingShip.status;

    // Update ship in database
    await pool.execute(
      'UPDATE ships SET name = ?, image_url = ?, redirect_url = ?, description = ?, status = ? WHERE id = ?',
      [name, image_url, redirect_url, description || null, shipStatus, shipId]
    );

    // Fetch and return updated ship
    const [updatedRows] = await pool.execute('SELECT * FROM ships WHERE id = ?', [shipId]);

    res.json({ success: true, ship: updatedRows[0] });
  } catch (err) {
    console.error('Error updating ship:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update ship',
      message: err.message 
    });
  }
});

// DELETE /api/ships/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const shipId = req.params.id;
    
    // Get ship to delete associated image
    const [ships] = await pool.execute('SELECT * FROM ships WHERE id = ?', [shipId]);
    
    if (ships.length > 0 && ships[0].image_url && ships[0].image_url.includes('/uploads/')) {
      const filename = ships[0].image_url.split('/uploads/')[1];
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error('Error deleting image file:', unlinkErr);
        }
      }
    }
    
    await pool.execute('DELETE FROM ships WHERE id = ?', [shipId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ship:', err);
    res.status(500).json({ error: 'Failed to delete ship' });
  }
});

module.exports = router;