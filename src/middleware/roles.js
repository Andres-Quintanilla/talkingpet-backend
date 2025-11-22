export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user?.rol) return res.status(403).json({ error: 'Sin rol' });
        if (!roles.includes(req.user.rol)) return res.status(403).json({ error: 'No autorizado' });
        next();
    };
}

export function isAdmin(req, res, next) {
    return requireRole('admin')(req, res, next);
}