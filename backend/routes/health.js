const express        = require('express');
const router         = express.Router();
const { requireAuth } = require('../middleware/auth');

const TUNNEL_DOWN_STATUSES = new Set([502, 503, 520, 521, 522, 523, 524, 530]);

router.get('/', requireAuth, async (req, res) => {
  const rawUrl = req.query.url;

  if (!rawUrl) {
    return res.status(400).json({ ok: false, status: 0, error: 'Missing url parameter' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(decodeURIComponent(rawUrl));
  } catch {
    return res.status(400).json({ ok: false, status: 0, error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ ok: false, status: 0, error: 'Protocol not allowed' });
  }
  const controller  = new AbortController();
  const timeoutId   = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(targetUrl.toString(), {
      method:  'HEAD',        
      signal:  controller.signal,
      headers: {
        'User-Agent': 'DtyleAI-HealthCheck/1.0',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const tunnelDown = TUNNEL_DOWN_STATUSES.has(response.status);

    return res.json({
      ok:     !tunnelDown && response.status < 400,
      status: response.status,
    });

  } catch (err) {
    clearTimeout(timeoutId);

    const isTimeout = err.name === 'AbortError';
    console.warn(`[HealthCheck] ${isTimeout ? 'Timeout' : 'Error'} → ${targetUrl.toString()}`);

    return res.json({
      ok:     false,
      status: 0,
      error:  isTimeout ? 'timeout' : 'unreachable',
    });
  }
});

module.exports = router;