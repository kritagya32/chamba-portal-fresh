// api/proxy.js
export default async function handler(req, res) {
  try {
    const APPSCRIPT = process.env.APPSCRIPT_URL;
    if (!APPSCRIPT) {
      res.status(500).json({ error: 'APPSCRIPT_URL not configured on server' });
      return;
    }

    // Build target URL including querystring if present
    const qs = req.url.includes('?') ? req.url.split('?')[1] : '';
    const targetUrl = APPSCRIPT + (qs ? `?${qs}` : '');

    const fetchOptions = {
      method: req.method,
      headers: {
        // Forward content-type and optionally an auth key
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
    };

    // Optionally append a server-side key in query if APPSCRIPT_KEY present
    const urlWithKey = process.env.APPSCRIPT_KEY ? (targetUrl + (targetUrl.includes('?') ? '&' : '?') + `key=${encodeURIComponent(process.env.APPSCRIPT_KEY)}`) : targetUrl;

    const upstream = await fetch(urlWithKey, fetchOptions);
    const text = await upstream.text();

    // Set permissive CORS (client talks to same origin, but keep)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.status(upstream.status).send(text);
  } catch (err) {
    console.error('proxy error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: err.message || 'Proxy error' });
  }
}
