import { z } from 'zod';
export const productSchema = z.object({
    nombre: z.string().min(2),
    descripcion: z.string().optional(),
    categoria: z.string().optional(),
    precio: z.coerce.number().positive(),
    stock: z.coerce.number().int().nonnegative(),
    imagen_url: z.string().optional(),
    activo: z.boolean().optional()
});
