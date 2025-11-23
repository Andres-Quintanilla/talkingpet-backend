// src/controllers/customerAddress.controller.js
import { pool } from "../config/db.js";

// GET /api/customers/service-address
export const getMyServiceAddress = async (req, res) => {
  try {
    const idCliente = req.user?.id;

    if (!idCliente) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const { rows } = await pool.query(
      `SELECT id_direccion, referencia, numero_casa, manzano,
              latitud, longitud
       FROM cliente_direccion_servicio
       WHERE id_cliente = $1 AND es_principal = TRUE
       LIMIT 1`,
      [idCliente]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Sin dirección guardada" });
    }

    const row = rows[0];
    return res.json({
      id_direccion: row.id_direccion,
      referencia: row.referencia,
      numero_casa: row.numero_casa,
      manzano: row.manzano,
      lat: row.latitud,
      lng: row.longitud,
    });
  } catch (err) {
    console.error("getMyServiceAddress error:", err);
    return res.status(500).json({ message: "Error obteniendo dirección" });
  }
};

// POST /api/customers/service-address
export const upsertMyServiceAddress = async (req, res) => {
  try {
    const idCliente = req.user?.id;

    if (!idCliente) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const { referencia, numero_casa, manzano, lat, lng } = req.body;

    if (!referencia || !referencia.trim()) {
      return res
        .status(400)
        .json({ message: "La referencia de la dirección es obligatoria." });
    }

    // ¿Ya tiene dirección principal?
    const existing = await pool.query(
      `SELECT id_direccion
       FROM cliente_direccion_servicio
       WHERE id_cliente = $1 AND es_principal = TRUE
       LIMIT 1`,
      [idCliente]
    );

    let row;

    if (existing.rows.length) {
      const idDireccion = existing.rows[0].id_direccion;
      const updated = await pool.query(
        `UPDATE cliente_direccion_servicio
         SET referencia = $2,
             numero_casa = $3,
             manzano     = $4,
             latitud     = $5,
             longitud    = $6,
             fecha_actualizacion = now()
         WHERE id_direccion = $1
         RETURNING id_direccion, referencia, numero_casa, manzano, latitud, longitud`,
        [idDireccion, referencia, numero_casa, manzano, lat, lng]
      );
      row = updated.rows[0];
    } else {
      const inserted = await pool.query(
        `INSERT INTO cliente_direccion_servicio
           (id_cliente, referencia, numero_casa, manzano, latitud, longitud, es_principal)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id_direccion, referencia, numero_casa, manzano, latitud, longitud`,
        [idCliente, referencia, numero_casa, manzano, lat, lng]
      );
      row = inserted.rows[0];
    }

    return res.json({
      id_direccion: row.id_direccion,
      referencia: row.referencia,
      numero_casa: row.numero_casa,
      manzano: row.manzano,
      lat: row.latitud,
      lng: row.longitud,
    });
  } catch (err) {
    console.error("upsertMyServiceAddress error:", err);
    return res.status(500).json({ message: "Error guardando dirección" });
  }
};
