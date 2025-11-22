import { pool } from '../config/db.js';
import { bookingSchema } from '../validators/booking.validator.js';

export async function create(req, res, next) {
  try {
    const data = bookingSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO cita (usuario_id, mascota_id, servicio_id, empleado_id, modalidad, estado, fecha, hora, comentarios)
       VALUES ($1,$2,$3,NULL,$4,'pendiente',$5,$6,$7)
       RETURNING *`,
      [
        req.user.id,
        data.mascota_id || null,
        data.servicio_id,
        data.modalidad,
        data.fecha,
        data.hora,
        data.comentarios || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function mine(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT 
         c.*, 
         s.nombre AS servicio_nombre, 
         s.tipo AS servicio_tipo, 
         m.nombre AS mascota_nombre
       FROM cita c 
       LEFT JOIN servicio s ON s.id=c.servicio_id
       LEFT JOIN mascota m ON m.id=c.mascota_id
       WHERE c.usuario_id=$1 
       ORDER BY c.fecha DESC, c.hora DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function listAll(req, res, next) {
  try {
    const { rol } = req.user;

    let query = `
      SELECT 
        c.*, 
        s.nombre AS servicio_nombre, 
        s.tipo AS servicio_tipo, 
        m.nombre AS mascota_nombre,
        u.nombre AS cliente_nombre,
        u.telefono AS cliente_telefono
      FROM cita c
      LEFT JOIN servicio s ON s.id=c.servicio_id
      LEFT JOIN mascota m ON m.id=c.mascota_id
      LEFT JOIN usuario u ON u.id=c.usuario_id
    `;
    const params = [];

    if (rol !== 'admin') {
      let tipoServicio;
      if (rol === 'empleado_veterinario') tipoServicio = 'veterinaria';
      else if (rol === 'empleado_peluquero') tipoServicio = 'peluqueria'; 
      else if (rol === 'empleado_adiestrador') tipoServicio = 'adiestramiento';

      if (tipoServicio === 'peluqueria') {
        query += ` WHERE (s.tipo = 'peluqueria' OR s.tipo = 'baño')`;
      } else if (tipoServicio) {
        params.push(tipoServicio);
        query += ` WHERE s.tipo = $1`;
      } else {
        query += ` WHERE 1=0`;
      }
    }

    query += ` ORDER BY c.fecha DESC, c.hora DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { estado } = req.body;
    const { rows } = await pool.query(
      `UPDATE cita SET estado=$1 WHERE id=$2 RETURNING *`,
      [estado, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function getAvailability(req, res, next) {
  try {
    const { fecha, servicio_id } = req.query;
    if (!fecha || !servicio_id) {
      return res
        .status(400)
        .json({ error: 'Fecha y servicio_id son requeridos' });
    }

    const { rows: serviceRows } = await pool.query(
      'SELECT duracion_minutos FROM servicio WHERE id = $1',
      [servicio_id]
    );
    if (!serviceRows.length) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    const duracion = serviceRows[0].duracion_minutos;

    const { rows: citas } = await pool.query(
      `SELECT c.hora, s.duracion_minutos 
       FROM cita c
       JOIN servicio s ON c.servicio_id = s.id
       WHERE c.fecha = $1 AND c.estado IN ('pendiente', 'confirmada')`,
      [fecha]
    );

    const horariosDisponibles = [];
    const horaInicio = 9;
    const horaFin = 18; 
    const slotMinutos = 30; 

    for (let H = horaInicio; H < horaFin; H++) {
      for (let M = 0; M < 60; M += slotMinutos) {
        const horaSlot = new Date(
          `${fecha}T${String(H).padStart(2, '0')}:${String(M).padStart(
            2,
            '0'
          )}:00Z`
        );
        const horaFinSlot = new Date(horaSlot.getTime() + duracion * 60000);

        let ocupado = false;

        for (const cita of citas) {
          const citaInicio = new Date(`${fecha}T${cita.hora}Z`);
          const citaFin = new Date(
            citaInicio.getTime() + cita.duracion_minutos * 60000
          );

          const seSolapa = horaSlot < citaFin && horaFinSlot > citaInicio;

          if (seSolapa) {
            ocupado = true;
            break;
          }
        }

        if (!ocupado && horaFinSlot.getUTCHours() < horaFin) {
          horariosDisponibles.push(
            horaSlot.toUTCString().substring(17, 22)
          );
        } else if (
          !ocupado &&
          horaFinSlot.getUTCHours() === horaFin &&
          horaFinSlot.getUTCMinutes() === 0
        ) {
          horariosDisponibles.push(
            horaSlot.toUTCString().substring(17, 22)
          );
        }
      }
    }

    const horariosUnicos = [...new Set(horariosDisponibles)];

    res.json(horariosUnicos);
  } catch (e) {
    next(e);
  }
}

export async function getAdminSummary(req, res, next) {
  try {
    const { rows: kpiRows } = await pool.query(`
      SELECT
        COUNT(*) AS total_citas,
        COUNT(*) FILTER (WHERE estado = 'pendiente')   AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'confirmada')  AS confirmadas,
        COUNT(*) FILTER (WHERE estado = 'realizada')   AS realizadas
      FROM cita
    `);

    const { rows: recientes } = await pool.query(`
      SELECT
        c.id,
        c.fecha,
        c.hora,
        c.estado,
        s.nombre AS servicio,
        m.nombre AS mascota
      FROM cita c
      LEFT JOIN servicio s ON c.servicio_id = s.id
      LEFT JOIN mascota m ON c.mascota_id = m.id
      ORDER BY c.fecha DESC, c.hora DESC
      LIMIT 5
    `);

    res.json({
      kpis: kpiRows[0],
      recientes,
    });
  } catch (err) {
    next(err);
  }
}
