// api/proxy.js
export default async function handler(req, res) {
  try {
    const APPSCRIPT = process.env.APPSCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyp8XU8WH6GUsubXkdjAsD01I1zqJ-vy9sk4OBhe5JD_XXDKb94Ttx7X-JyZ5eep-64DA/exec';
    // Build target URL with query string if present
    const qs = req.url.split('?')[1] || '';
    const url = APPSCRIPT + (qs ? `?${qs}` : '');

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      // body should be raw for POST
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
    };

    const upstream = await fetch(url, fetchOptions);
    const text = await upstream.text();

    // CORS headers for the browser
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // forward status and body
    res.status(upstream.status).send(text);
  } catch (err) {
    console.error('proxy error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: err.message });
  }
}
// proxy placeholder 
