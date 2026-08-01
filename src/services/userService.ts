import { imageService } from "./imageService";
import { storageService } from "./storageService";
// Importe seu Model/ORM (Ex: Mongoose, Prisma, Knex, etc.)
import { User } from "../models/User";
import { UpdateUserInput } from "../schemas/userSchema";

export interface UserResponse {
    id: string;
    username: string;
    name: string;
    lastname?: string;
    bio?: string;
    profileUrl?: string;
}

/**
 * Orquestra o fluxo de atualização do perfil do PRÓPRIO usuário autenticado
 */
export const updateProfile = async (
    authenticatedUserId: string, // Garantido pelo middleware de autenticação (JWT/Sessão)
    userData: UpdateUserInput,
    file?: Express.Multer.File,
): Promise<UserResponse> => {
    // 1. Validação de segurança inicial
    if (!authenticatedUserId) {
        throw new Error("Acesso negado: ID do usuário autenticado é obrigatório.");
    }

    const { name, lastname, bio } = userData;

    console.log("userData: ", userData);

    // 2. Busca o usuário autenticado no banco de dados
    const currentUser = await User.findById(authenticatedUserId);
    if (!currentUser) {
        throw new Error("Usuário não encontrado ou não autorizado.");
    }

    let newProfileUrl: string | undefined = currentUser.profileUrl;

    // 3. Se um arquivo foi enviado, orquestra o pipeline de imagem
    if (file) {
        // A. Processa, valida e converte para WebP via imageService
        const processedImage = await imageService.processAvatar(file);

        // B. Define o caminho no bucket (ex: avatars/avatar-1689000000-a1b2c3.webp)
        const storagePath = `avatars/${processedImage.filename}`;

        // C. Envia o buffer pronto para o Supabase via storageService
        const uploadResult = await storageService.upload({
            path: storagePath,
            buffer: processedImage.buffer,
            contentType: processedImage.mimeType,
        });

        newProfileUrl = uploadResult.publicUrl;

        // D. Remove a imagem antiga do storage para evitar acúmulo de arquivos
        if (currentUser.profileUrl) {
            try {
                const oldPath = extractStoragePathFromUrl(currentUser.profileUrl);
                if (oldPath) {
                    await storageService.deleteFile(oldPath);
                }
            } catch (err) {
                console.warn("Falha ao deletar avatar antigo:", err);
            }
        }
    }

    // 4. Grava as alterações no DB (garantindo que APENAS o registro do próprio usuário é afetado)
    const updatedUser = await User.findByIdAndUpdate(
        authenticatedUserId,
        {
            ...(name !== undefined && { name }),
            ...(lastname !== undefined && { lastname }),
            ...(bio !== undefined && { bio }),
            ...(newProfileUrl !== undefined && { profileUrl: newProfileUrl }),
        },
        { new: true },
    );

    if (!updatedUser) {
        throw new Error("Falha ao atualizar as informações do perfil.");
    }

    return {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        name: updatedUser.name,
        lastname: updatedUser.lastname,
        bio: updatedUser.bio,
        profileUrl: updatedUser.profileUrl,
    };
};

/**
 * Função utilitária para extrair o caminho relativo no bucket a partir da URL pública
 */
const extractStoragePathFromUrl = (url: string): string | null => {
    try {
        const parts = url.split("/avatars/");
        return parts.length > 1 ? `avatars/${parts[1]}` : null;
    } catch {
        return null;
    }
};

// Export agrupado no modelo funcional
export const userService = {
    updateProfile,
};
