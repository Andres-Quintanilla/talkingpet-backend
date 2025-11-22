import { z } from 'zod';

export const registerSchema = z.object({
    nombre: z.string().min(3),
    email: z.string().email(),
    telefono: z.string().optional(),
    contrasena: z.string().min(6)
});
export const loginSchema = z.object({
    email: z.string().email(),
    contrasena: z.string().min(6)
});
