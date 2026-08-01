import { Request, Response, NextFunction } from "express";
import multer from "multer";

const MAX_SIZE_LIMIT = 50; // (MB)

// Armazenamento em memória
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_SIZE_LIMIT * 1024 * 1024, // Limite genérico de tamanho bruto (50MB)
    },
});

const singleUpload = upload.single("avatar"); // ou 'photo' / 'image'

/**
 * Middleware focado puramente em extrair o arquivo da requisição
 */
export const uploadMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.log("uploadMiddleware")
    singleUpload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    error: `O arquivo enviado ultrapassa o limite máximo de ${MAX_SIZE_LIMIT}MB.`,
                });
            }
            return res.status(400).json({ error: `Erro no upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        next();
    });
};