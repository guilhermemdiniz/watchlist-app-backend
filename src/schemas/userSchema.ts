import { z } from "zod";

export const updateUserSchema = z.object({
    name: z
        .string()
        .trim()
        .max(50, "O nome deve ter no máximo 50 caracteres.")
        .optional(),
    lastname: z
        .string()
        .trim()
        .max(50, "O sobrenome deve ter no máximo 50 caracteres.")
        .optional(),
    bio: z
        .string()
        .trim()
        .max(250, "A bio deve ter no máximo 250 caracteres.")
        .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;