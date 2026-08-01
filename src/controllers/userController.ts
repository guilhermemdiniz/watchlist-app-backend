import { Request, Response } from "express";
import { ZodError } from "zod";
import { updateUserSchema } from "../schemas/userSchema";
import { updateProfile as updateUserService } from "../services/userService";

/**
 * Controller da rota PUT /api/user
 */
export const updateProfile = async (
    req: Request,
    res: Response
): Promise<Response> => {
    console.log("updateProfile")
    try {
        // 1. Garante que o usuário está autenticado
        const authenticatedUserId = req.userId || "";

        if (!authenticatedUserId) {
            return res.status(401).json({
                error: "Acesso não autorizado. Usuário não autenticado.",
            });
        }

        console.log("req.body: ", req.body);

        // 2. Valida os campos textuais com Zod
        const validatedData = updateUserSchema.parse(req.body);

        // 3. Invoca o service com o ID seguro, dados validados e arquivo (opcional)
        const updatedUser = await updateUserService(
            authenticatedUserId.toString(),
            validatedData,
            req.file
        );

        // 4. Retorna resposta de sucesso
        return res.status(200).json(updatedUser);
    } catch (error: any) {
        // Tratamento de erros específicos de validação do Zod
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: "Erro de validação nos campos informados.",
                details: error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                })),
            });
        }

        // Tratamento de erros das camadas de serviço (ImageService, StorageService, etc)
        return res.status(400).json({
            error: error.message || "Erro ao atualizar o perfil do usuário.",
        });
    }
};