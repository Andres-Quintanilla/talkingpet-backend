import { pool } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function sign(u) {
  const payload = {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    saldo: u.saldo ?? 0,
    tema: u.tema, 
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { user: payload, token };
}

export async function register(req, res, next) {
  try {
    const { nombre, email, contrasena, telefono } = req.body;

    // Validaciones básicas de campos
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
    }
    if (!contrasena || contrasena.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Validar email duplicado
    const emailCheck = await pool.query(
      'SELECT 1 FROM usuario WHERE lower(email)=lower($1)',
      [email]
    );
    if (emailCheck.rowCount > 0) {
      return res.status(409).json({ error: 'El correo ya está registrado.' });
    }

    // Validar nombre de usuario duplicado
    const userCheck = await pool.query(
      'SELECT 1 FROM usuario WHERE lower(nombre)=lower($1)',
      [nombre]
    );
    if (userCheck.rowCount > 0) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuario (nombre, email, telefono, contrasena)
       VALUES ($1,$2,$3,$4)
       RETURNING id, nombre, email, rol, saldo, tema`,
      [nombre.trim(), email.trim(), telefono || null, hash]
    );

    return res.status(201).json(sign(rows[0]));
  } catch (e) {
    next(e);
  }
}


export async function login(req, res, next) {
  try {
    const { email, nombre, contrasena } = req.body;

    // Validación de campos vacíos
    if ((!email && !nombre)) {
      return res.status(400).json({ error: 'Ingresa tu correo o nombre de usuario.' });
    }
    if (!contrasena) {
      return res.status(400).json({ error: 'Ingresa tu contraseña.' });
    }

    // Buscar usuario por correo o username
    const { rows } = await pool.query(
      `SELECT * FROM usuario
       WHERE (lower(email)=lower($1) OR lower(nombre)=lower($2))
       LIMIT 1`,
      [email || '', nombre || '']
    );

    const u = rows[0];

    // Usuario no encontrado
    if (!u) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Usuario encontrado pero está inactivo
    if (!u.activo) {
      return res.status(403).json({
        error: 'Tu cuenta está inactiva. Contacta al administrador.'
      });
    }

    // Contraseña incorrecta
    const ok = await bcrypt.compare(contrasena, u.contrasena);
    if (!ok) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // OK: devolver token + datos
    return res.json(sign(u));

  } catch (e) {
    next(e);
  }
}

export async function me(req, res) {
  return res.json(req.user);
}

export async function forgotPassword(req, res, next) {
  try {
    const { emailOrUser } = req.body;
    if (!emailOrUser) return res.status(400).json({ error: 'Dato requerido' });

    const { rows } = await pool.query(
      `SELECT id, email FROM usuario
       WHERE lower(email)=lower($1) OR lower(nombre)=lower($1) LIMIT 1`,
      [emailOrUser]
    );
    const u = rows[0];
    if (!u) return res.json({ ok: true }); 

    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); 

    await pool.query(
      `INSERT INTO password_reset (usuario_id, token, expires_at) VALUES ($1,$2,$3)`,
      [u.id, token, expires]
    );

    const resetLink = `${
      process.env.PUBLIC_BASE_URL || 'http://localhost:5173'
    }/reset?token=${token}`;
    console.log('[reset-link]', resetLink); 

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, nueva } = req.body;
    if (!token || !nueva)
      return res.status(400).json({ error: 'Datos inválidos' });

    const { rows } = await pool.query(
      `SELECT pr.id, pr.usuario_id FROM password_reset pr
       WHERE pr.token=$1 AND pr.used=FALSE AND pr.expires_at>NOW() LIMIT 1`,
      [token]
    );
    const r = rows[0];
    if (!r) return res.status(400).json({ error: 'Token inválido' });

    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuario SET contrasena=$1 WHERE id=$2', [
      hash,
      r.usuario_id,
    ]);
    await pool.query('UPDATE password_reset SET used=TRUE WHERE id=$1', [r.id]);

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}