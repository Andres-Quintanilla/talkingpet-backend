// src/controllers/course.controller.js
import { pool } from '../config/db.js';

const API_BASE =
  process.env.API_PUBLIC_BASE_URL ||
  `http://localhost:${process.env.PORT || 4000}`;

// Convierte rutas relativas (/uploads/...) en URLs completas
function toPublicUrl(url) {
  if (!url) return null;

  // Ya absoluta
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // /uploads/archivo.mp4
  if (url.startsWith('/')) {
    return `${API_BASE}${url}`;
  }

  // uploads/archivo.mp4
  if (url.startsWith('uploads/')) {
    return `${API_BASE}/${url}`;
  }

  return url;
}

export async function list(_req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id,
              titulo,
              descripcion,
              precio,
              estado,
              modalidad,
              cupos_totales,
              fecha_inicio_presencial,
              portada_url,
              trailer_url
       FROM curso
       WHERE estado = 'publicado'
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function adminList(_req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id,
              titulo,
              descripcion,
              precio,
              estado,
              modalidad,
              cupos_totales,
              fecha_inicio_presencial,
              portada_url,
              trailer_url
       FROM curso
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Id de curso inválido' });
    }

    const { rows: courseRows } = await pool.query(
      `SELECT c.*,
              u.nombre AS instructor_nombre
       FROM curso c
       LEFT JOIN usuario u ON c.instructor_id = u.id
       WHERE c.id = $1
         AND c.estado = 'publicado'
       LIMIT 1`,
      [id]
    );

    const curso = courseRows[0];
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    // Normalizar URLs de portada y trailer
    curso.portada_url = toPublicUrl(curso.portada_url);
    curso.trailer_url = toPublicUrl(curso.trailer_url);

    let contenido = [];
    if (curso.modalidad === 'virtual') {
      const { rows } = await pool.query(
        `SELECT id, curso_id, tipo, titulo, url, duracion_minutos
         FROM curso_contenido
         WHERE curso_id = $1
         ORDER BY id ASC`,
        [id]
      );

      // Normalizamos URL de cada contenido
      contenido = rows.map((r) => ({
        ...r,
        url: toPublicUrl(r.url),
      }));

      // Si no hay contenido aún, usamos el trailer como "lección 0"
      if (contenido.length === 0 && curso.trailer_url) {
        contenido = [
          {
            id: `trailer-${curso.id}`,
            curso_id: curso.id,
            tipo: 'video',
            titulo: 'Introducción / Trailer',
            url: curso.trailer_url,
            duracion_minutos: 0,
          },
        ];
      }
    }

    res.json({ ...curso, contenido });
  } catch (e) {
    next(e);
  }
}

export async function mine(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT 
          ic.id,
          ic.curso_id,
          COALESCE(c.titulo, ic.titulo_snapshot)  AS titulo,
          COALESCE(c.precio, ic.precio_snapshot)  AS precio,
          ic.progreso,
          c.modalidad,
          c.portada_url
       FROM inscripcion_curso ic
       LEFT JOIN curso c ON c.id = ic.curso_id
       WHERE ic.usuario_id = $1
       ORDER BY ic.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function enroll(req, res, next) {
  try {
    const id = Number(req.params.id);

    const { rows: cur } = await pool.query(
      'SELECT titulo, precio FROM curso WHERE id = $1',
      [id]
    );
    if (!cur[0]) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    await pool.query(
      `INSERT INTO inscripcion_curso
         (usuario_id, curso_id, titulo_snapshot, precio_snapshot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, curso_id) DO NOTHING`,
      [req.user.id, id, cur[0].titulo, cur[0].precio]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const {
      titulo,
      descripcion,
      estado = 'borrador',
      precio = null,
      modalidad = 'virtual',
      cupos_totales = null,
      fecha_inicio_presencial = null,
      portada_url = null,
      trailer_url = null,
    } = req.body;

    // Si viene un archivo (ej: video subido directo a este endpoint)
    let finalTrailerUrl = trailer_url || null;
    if (req.file && req.file.filename) {
      finalTrailerUrl = `${API_BASE}/uploads/${req.file.filename}`;
    }

    const { rows } = await pool.query(
      `INSERT INTO curso
        (titulo, descripcion, estado, precio, fecha_publicacion,
         instructor_id, modalidad, cupos_totales, fecha_inicio_presencial,
         portada_url, trailer_url)
       VALUES
        ($1,$2,$3,$4,NOW(),$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        titulo,
        descripcion || null,
        estado,
        precio,
        req.user.id,
        modalidad,
        cupos_totales,
        fecha_inicio_presencial,
        portada_url,
        finalTrailerUrl,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const {
      titulo,
      descripcion,
      estado,
      precio,
      modalidad,
      cupos_totales,
      fecha_inicio_presencial,
      portada_url,
      trailer_url,
    } = req.body;

    // Si viene string vacío o null → null
    let finalTrailerUrl =
      trailer_url && trailer_url.trim() !== "" ? trailer_url.trim() : null;

    // Archivo subido → reemplazar totalmente
    if (req.file && req.file.filename) {
      finalTrailerUrl = `${API_BASE}/uploads/${req.file.filename}`;
    }

    const { rows } = await pool.query(
      `UPDATE curso
       SET titulo                  = $2,
           descripcion             = $3,
           estado                  = $4,
           precio                  = $5,
           modalidad               = $6,
           cupos_totales           = $7,
           fecha_inicio_presencial = $8,
           portada_url             = $9,
           trailer_url             = $10
       WHERE id = $1
       RETURNING *`,
      [
        id,
        titulo || null,
        descripcion || null,
        estado || null,
        precio ?? null,
        modalidad || null,
        cupos_totales ?? null,
        fecha_inicio_presencial || null,
        portada_url || null,
        finalTrailerUrl,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "No encontrado" });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}


export async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM curso WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
