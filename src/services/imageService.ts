import sharp from "sharp";
import path from "path";
import crypto from "crypto";

export interface ProcessedImageResult {
    buffer: Buffer;
    extension: "webp";
    mimeType: "image/webp";
    width: number;
    height: number;
    filename: string;
}

// Configurações e limites imutáveis no escopo do módulo
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/pjpeg",
    "image/png",
    "image/webp",
    "image/heic",
] as const;

const ALLOWED_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
] as const;

const TARGET_SIZE = 256;
const MIN_DIMENSION = 10; // Dimensão mínima aceita
const WEBP_QUALITY = 80;   // Taxa de compressão (0-100)

/**
 * Gera um nome único no padrão avatar-{timestamp}-{hash}.webp
 */
const generateFilename = (): string => {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(6).toString("hex");
    return `avatar-${timestamp}-${randomHash}.webp`;
};

/**
 * Valida, redimensiona, comprime e converte a imagem do avatar para WebP
 */
export const processAvatar = async (
    file?: Express.Multer.File
): Promise<ProcessedImageResult> => {
    if (!file || !file.buffer) {
        throw new Error("Arquivo de imagem não fornecido.");
    }

    // 1. Validação da extensão
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
        throw new Error(
            `Extensão '${ext}' inválida. Extensões permitidas: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
    }

    // 2. Validação do MIME Type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
        throw new Error(
            `MIME Type '${file.mimetype}' inválido. Tipos permitidos: ${ALLOWED_MIME_TYPES.join(", ")}`
        );
    }

    // 3. Inspeção de dimensões via Sharp
    const sharpInstance = sharp(file.buffer);
    const metadata = await sharpInstance.metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error("Não foi possível ler as dimensões da imagem.");
    }

    if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
        throw new Error(
            `A imagem deve ter no mínimo ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`
        );
    }

    // 4. Otimização e conversão
    const processedBuffer = await sharpInstance
        .rotate()
        .resize(TARGET_SIZE, TARGET_SIZE, {
            fit: "cover",
            position: "center",
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

    // 5. Retorno do contrato
    return {
        buffer: processedBuffer,
        extension: "webp",
        mimeType: "image/webp",
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        filename: generateFilename(),
    };
};

// Export agrupado opcional (mantém a ergonomia `imageService.processAvatar(file)`)
export const imageService = {
    processAvatar,
};