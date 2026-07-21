// backend/src/routes/movieRoutes.ts
import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { scrapeLetterboxdFastPreview } from '../services/scraperService';
import { Movie } from '../models/Movie';

const router = Router();

const saveMovieSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  year: z.number().optional(),
  director: z.string().optional(),
  synopsis: z.string().optional(),
  posterUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  letterboxdSlug: z.string().optional(),
  genres: z.array(z.string()).optional().default([]),
});

/**
 * @openapi
 * /api/movies/save:
 *   post:
 *     tags: [Movies]
 *     summary: Save or retrieve an existing movie (Upsert/Cache)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               year:
 *                 type: number
 *               director:
 *                 type: string
 *               synopsis:
 *                 type: string
 *               posterUrl:
 *                 type: string
 *               sourceUrl:
 *                 type: string
 *               letterboxdSlug:
 *                 type: string
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Movie already existed and was retrieved
 *       201:
 *         description: New movie created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = saveMovieSchema.parse(req.body);

    // Estratégia de Upsert / Cache: Busca primeiro por sourceUrl ou letterboxdSlug
    const queryConditions: any[] = [];
    if (data.sourceUrl) queryConditions.push({ sourceUrl: data.sourceUrl });
    if (data.letterboxdSlug) queryConditions.push({ letterboxdSlug: data.letterboxdSlug });

    if (queryConditions.length > 0) {
      const existingMovie = await Movie.findOne({ $or: queryConditions });
      if (existingMovie) {
        return res.status(200).json(existingMovie);
      }
    }

    // Se não existir, cria o novo registro
    const newMovie = await Movie.create(data);
    return res.status(201).json(newMovie);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const extractSchema = z.object({
  url: z.string().url().refine(
    (val) => val.includes('letterboxd.com/film/') || val.includes('boxd.it/'),
    { message: 'URL must be a valid letterboxd.com or boxd.it link' }
  ),
});

/**
 * @openapi
 * /api/movies/extract:
 *   post:
 *     tags: [Movies]
 *     summary: Extract movie data and high-res poster
 *     description: Resolves shortlinks, fetches complete metadata, and resolves poster images via Letterboxd internal API. Uses DB cache when available.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 example: "https://boxd.it/QFQU"
 *     responses:
 *       200:
 *         description: Extracted metadata with poster and backdrop cover
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 posterUrl:
 *                   type: string
 *                 coverUrl:
 *                   type: string
 *                 sourceUrl:
 *                   type: string
 *                 genres:
 *                   type: array
 *                   items:
 *                     type: string
 *                 rating:
 *                   type: number
 *                   example: 4.23
 *       400:
 *         description: Invalid URL
 *       401:
 *         description: Unauthorized
 */
router.post('/extract', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = extractSchema.parse(req.body);
    const data = await scrapeLetterboxdFastPreview(url);
    res.json(data);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message || 'Failed to extract movie data' });
  }
});

export default router;