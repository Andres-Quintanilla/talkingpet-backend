import { z } from 'zod';
export const courseSchema = z.object({
    titulo: z.string().min(3),
    descripcion: z.string().optional(),
    estado: z.enum(['borrador', 'publicado', 'archivado']).optional(),
    precio: z.coerce.number().positive().optional()
});
