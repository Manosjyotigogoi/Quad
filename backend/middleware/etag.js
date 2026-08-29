import crypto from 'crypto';

// THIRD-PASS OPTIMIZATION — ETag middleware for read-only GET responses.
//
// For responses that are expensive to compute (e.g. /api/listings with
// filters, /api/categories), we compute a weak ETag from the response
// body. If the client sends If-None-Match with a matching ETag, we
// short-circuit with 304 Not Modified — saving bandwidth + parse time
// for the client and a bit of CPU on the server.
//
// We use weak ETags (W/"...") because strong ETags require byte-for-byte
// identical responses, which breaks if any JSON serializer changes
// field order. Weak ETags only promise semantic equivalence.
//
// Limitations:
//   - We hash the body AFTER compression, so this only helps when the
//     response isn't compressed (compression middleware runs before
//     this middleware's res.end intercept).
//   - For large responses (>1MB), the hash itself adds ~5ms. We skip
//     ETag generation for large responses and just send the body.
//
// Usage:
//   router.get('/listings', etag, controller.getListings);

const MAX_BODY_SIZE_FOR_ETAG = 1_000_000; // 1MB

export function etag(req, res, next) {
  // Only generate ETags for GET requests that succeeded (2xx).
  if (req.method !== 'GET') return next();

  // Monkey-patch res.send so we can compute the ETag from the body
  // before it's written to the wire.
  const originalSend = res.send.bind(res);
  res.send = function (body) {
    // Only set ETag if the response is 2xx and the body is small enough.
    const statusCode = res.statusCode || 200;
    if (statusCode >= 200 && statusCode < 300) {
      const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      if (bodyBuf.length > 0 && bodyBuf.length <= MAX_BODY_SIZE_FOR_ETAG) {
        const hash = crypto.createHash('sha1').update(bodyBuf).digest('hex').slice(0, 16);
        const etagValue = `W/"${hash}"`;
        res.setHeader('ETag', etagValue);

        // Check If-None-Match — if it matches, short-circuit with 304.
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === etagValue) {
          res.status(304);
          return originalSend('');
        }
      }
    }
    return originalSend(body);
  };
  next();
}
