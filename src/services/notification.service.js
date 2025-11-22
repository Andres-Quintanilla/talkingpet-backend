import nodemailer from "nodemailer";
import twilio from "twilio";

// Configuración Gmail
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

let emailTransporter = null;

if (gmailUser && gmailAppPassword) {
  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });
}

// Configuración Twilio (WhatsApp)
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;

let twilioClient = null;

if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

/**
 * Envía un email usando Gmail
 * @param {string} to - Email destinatario
 * @param {string} subject - Asunto
 * @param {string} text - Contenido en texto plano
 * @param {string} html - Contenido HTML (opcional)
 */
export async function sendEmail(to, subject, text, html = null) {
  if (!emailTransporter) {
    console.warn("⚠️ Gmail no configurado. Email no enviado:", { to, subject });
    return { success: false, error: "Gmail no configurado" };
  }

  try {
    const info = await emailTransporter.sendMail({
      from: `"TalkingPet" <${gmailUser}>`,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    });

    console.log("✅ Email enviado:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error enviando email:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envía un mensaje de WhatsApp usando Twilio
 * @param {string} to - Número de teléfono (formato E.164: +591...)
 * @param {string} message - Contenido del mensaje
 */
export async function sendWhatsApp(to, message) {
  if (!twilioClient || !twilioWhatsAppFrom) {
    console.warn("⚠️ Twilio WhatsApp no configurado. Mensaje no enviado:", { to, message });
    return { success: false, error: "Twilio WhatsApp no configurado" };
  }

  try {
    // Normalizar número: asegurar que empiece con 'whatsapp:+'
    const normalizedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const msg = await twilioClient.messages.create({
      from: twilioWhatsAppFrom,
      to: normalizedTo,
      body: message
    });

    console.log("✅ WhatsApp enviado:", msg.sid);
    return { success: true, sid: msg.sid };
  } catch (error) {
    console.error("❌ Error enviando WhatsApp:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Programa un recordatorio (guarda en BD, se enviará más tarde con un cron job)
 * En producción, implementar un worker o cron que lea chat_recordatorio pendientes
 */
export async function scheduleReminder(conversationId, type, recipient, subject, message, scheduledFor, pool) {
  const query = `
    INSERT INTO chat_recordatorio (conversacion_id, tipo, destinatario, asunto, mensaje, programado_para)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const values = [conversationId, type, recipient, subject, message, scheduledFor];
  
  try {
    const result = await pool.query(query, values);
    return { success: true, reminderId: result.rows[0].id };
  } catch (error) {
    console.error("❌ Error guardando recordatorio:", error.message);
    return { success: false, error: error.message };
  }
}
