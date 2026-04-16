require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes        = require('./routes/auth');
const shipsRoutes       = require('./routes/ships');
const healthCheckRoutes = require('./routes/health');
const path              = require('path');

const app  = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:4200',
  process.env.ANGULAR_APP_URL,
  process.env.NEXT_APP_URL,
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/uploads',             express.static(path.join(__dirname, 'uploads')));
app.use('/api',                 authRoutes);
app.use('/api/ships',           shipsRoutes);
app.use('/api/health-check',    healthCheckRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error('[Express Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`✅  Express SSO backend  →  http://localhost:${PORT}`));