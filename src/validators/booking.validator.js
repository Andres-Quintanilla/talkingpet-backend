import { z } from 'zod';
export const bookingSchema = z.object({
    usuario_id: z.coerce.number().int().optional(),
    mascota_id: z.coerce.number().int().optional(),
    servicio_id: z.coerce.number().int(),
    modalidad: z.enum(['local', 'domicilio', 'retiro_entrega']),
    fecha: z.string().min(10), 
    hora: z.string().min(5),   
    comentarios: z.string().optional()
});
