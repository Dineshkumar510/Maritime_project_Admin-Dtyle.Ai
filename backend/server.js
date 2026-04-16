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
  process.env.ANGULAR_APP_URL,
  process.env.NEXT_APP_URL,
  process.env.ADMIN_TUNNEL_URL, 
].filter(Boolean);

const allowedOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/,
  /^https:\/\/[a-z0-9-]+\.ngrok\.io$/,
];

function isAllowedOrigin(origin) {
  if (!origin) return true;                             
  if (allowedOrigins.includes(origin)) return true;
  return allowedOriginPatterns.some(rx => rx.test(origin));
}

app.use(cors({
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return cb(null, false);
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