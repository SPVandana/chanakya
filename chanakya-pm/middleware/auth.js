/**
 * JWT authentication middleware.
 * Reads the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded user payload to req.user.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('\n  ✗ JWT_SECRET is missing or too short (<16 chars).');
  console.error('    Set it in your environment (e.g. .env file or Render dashboard):');
  console.error('      JWT_SECRET=$(openssl rand -hex 32)\n');
  process.exit(1);
}

/**
 * requireAuth — Express middleware that enforces a valid JWT.
 * Attach to any route that should be protected.
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, name, role, iat, exp }
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
}

/**
 * signToken — creates a signed JWT for a user object.
 * @param {Object} user  { id, email, name, role }
 * @returns {string}     signed JWT (expires in 7 days by default)
 */
function signToken(user) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions || 'view' },
    JWT_SECRET,
    { expiresIn }
  );
}

module.exports = { requireAuth, signToken };
