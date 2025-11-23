// src/middleware/roles.js

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.rol;

    if (!userRole) {
      return res.status(403).json({ error: 'Sin rol o no autenticado' });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    next();
  };
}

export function isAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}
