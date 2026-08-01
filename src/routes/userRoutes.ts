import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { uploadMiddleware } from "../middlewares/uploadMiddleware";
import { updateProfile } from "../controllers/userController";

const router = Router();

/**
 * @openapi
 * /api/user:
 *   put:
 *     summary: Atualiza os dados do perfil do usuário autenticado
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Primeio nome do usuário
 *                 example: João
 *               lastname:
 *                 type: string
 *                 description: Sobrenome do usuário
 *                 example: Silva
 *               bio:
 *                 type: string
 *                 description: Biografia ou descrição do usuário
 *                 example: Entusiasta de cinema e desenvolvedor.
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Foto de perfil (JPEG, PNG, WebP, HEIC - máx 10MB)
 *     responses:
 *       200:
 *         description: Perfil do usuário atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "64a7b2c9e8f1a234567890ab"
 *                 username:
 *                   type: string
 *                   example: "joao.silva"
 *                 name:
 *                   type: string
 *                   example: "João"
 *                 lastname:
 *                   type: string
 *                   example: "Silva"
 *                 bio:
 *                   type: string
 *                   example: "Entusiasta de cinema e desenvolvedor."
 *                 profileUrl:
 *                   type: string
 *                   example: "https://xyz.supabase.co/storage/v1/object/public/avatars/avatar-1689000000-a1b2c3.webp"
 *       400:
 *         description: Erro de validação nos campos, formato de imagem inválido ou falha no upload.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erro de validação nos campos informados."
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "bio"
 *                       message:
 *                         type: string
 *                         example: "A bio deve ter no máximo 250 caracteres."
 *       401:
 *         description: Não autorizado (Token ausente ou inválido).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Acesso não autorizado. Usuário não autenticado."
 */
router.put("/", authMiddleware, uploadMiddleware, updateProfile);

export default router;