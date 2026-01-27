Tiny OpenAI Proxy

Quick start

1. Install dependencies

```bash
cd server
npm install
```

2. Create `.env` (copy from `.env.example`) and set values:
- `OPENAI_API_KEY` — your server-side OpenAI key
- `PROXY_TOKEN` — a shared secret to restrict browser clients
- `ALLOWED_ORIGINS` — comma-separated allowed origins (default `http://localhost:8080`)

3. Run the proxy

```bash
npm start
```

4. From the frontend, call the proxy instead of api.openai.com. Example fetch:

```js
fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-proxy-token': 'your-proxy-token'
  },
  body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [...]} ),
})
```

Security notes
- Keep `OPENAI_API_KEY` only on the server; never expose it in the browser.
- Use `PROXY_TOKEN` to prevent open proxy usage from unknown clients.
- The proxy includes rate-limiting and CORS allow-listing.

Production notes
- Run behind TLS (HTTPS) and a reverse proxy.
- Use authentication and per-user rate limits for multi-user setups.
