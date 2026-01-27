require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
app.use(express.json({ limit: '128kb' }));

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',');
const PROXY_TOKEN = process.env.PROXY_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
    console.error('Missing OPENAI_API_KEY in environment. Set it before starting the proxy.');
    process.exit(1);
}

// Basic CORS - restrict to known origins
app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin like curl or server-to-server
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
        callback(new Error('CORS policy: Origin not allowed'));
    }
}));

// Rate limiter
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: Number(process.env.RATE_LIMIT || 60),
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Proxy endpoint for Chat Completions
app.post('/v1/chat/completions', async (req, res) => {
    try {
        // Require proxy token to prevent public open proxy
        const token = req.headers['x-proxy-token'] || req.query.proxy_token;
        if (PROXY_TOKEN && token !== PROXY_TOKEN) {
            return res.status(401).json({ error: 'Invalid proxy token' });
        }

        // Forward request to OpenAI
        const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify(req.body),
        });

        const text = await openaiResp.text();
        res.status(openaiResp.status).send(text);
    } catch (err) {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy internal error' });
    }
});

app.listen(PORT, () => {
    console.log(`OpenAI proxy listening on http://localhost:${PORT}`);
});
