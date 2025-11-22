import { pool } from "../config/db.js";

/**
 * Guarda el feedback (útil/no útil) de un mensaje del bot
 */
export async function saveFeedback(messageId, isUseful, comment = null) {
  try {
    // Buscamos el ID del mensaje en la tabla chat_mensaje
    const msgQuery = await pool.query("SELECT id FROM chat_mensaje WHERE id = $1", [messageId]);
    if (msgQuery.rowCount === 0) {
        return { success: false, error: "Message ID not found" };
    }

    await pool.query(
      `INSERT INTO chat_feedback (mensaje_id, util, comentario) 
       VALUES ($1, $2, $3)`,
      [messageId, isUseful, comment]
    );
    return { success: true };
  } catch (error) {
    console.error("Error guardando feedback:", error);
    return { success: false, error: error.message };
  }
}