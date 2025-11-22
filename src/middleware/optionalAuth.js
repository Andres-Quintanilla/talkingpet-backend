import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'dev_secret';

export function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
  } catch {

  }

  next();
}