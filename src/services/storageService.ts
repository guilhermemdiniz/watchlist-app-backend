import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

// Nome do Bucket configurado no Supabase (pode vir de env)
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "";

export interface UploadOptions {
    path: string;
    buffer: Buffer;
    contentType: string;
}

export interface UploadResult {
    path: string;
    publicUrl: string;
}

/**
 * Envia o buffer da imagem diretamente para o Supabase Storage
 */
export const upload = async ({ path, buffer, contentType }: UploadOptions): Promise<UploadResult> => {
    console.log(path);
    console.log("BUCKET_NAME: ", BUCKET_NAME);
    // 1. Upload do Buffer para o bucket no Supabase
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(path, buffer, {
        contentType,
        upsert: true, // Sobrescreve caso já exista um arquivo no mesmo caminho
    });

    if (error) {
        throw new Error(`Erro no upload para o Supabase Storage: ${error.message}`);
    }

    // 2. Obtém a URL pública gerada para o arquivo
    const { data: publicURL } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

    return {
        path: data.path,
        publicUrl: publicURL.publicUrl,
    };
};

/**
 * Remove um arquivo do Supabase Storage (útil para apagar a foto antiga do usuário)
 */
export const deleteFile = async (path: string): Promise<void> => {
    if (!path) return;

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

    if (error) {
        throw new Error(`Erro ao remover arquivo do Supabase Storage: ${error.message}`);
    }
};

// Export agrupado
export const storageService = {
    upload,
    deleteFile,
};
