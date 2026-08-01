// backend/src/routes/watchlistRoutes.ts
import { Router, Response } from 'express';
import { z } from 'zod';
import { Watchlist } from '../models/Watchlist';
import { Movie } from '../models/Movie';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// Schemas de Validação
const createWatchlistSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  collaborators: z.array(z.string()).optional().default([]),
  allowedTags: z.array(z.string()).optional().default([]),
});

const syncWatchlistMovieItemSchema = z.object({
  movie: z.string().min(1, 'movie is required'),
  watched: z.boolean(),
  tags: z.array(z.string()).default([]),
});

const syncWatchlistSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  allowedTags: z.array(z.string()).optional(),
  movies: z.array(syncWatchlistMovieItemSchema).optional(),
});

/**
 * @openapi
 * /api/watchlists:
 *   post:
 *     tags: [Watchlists]
 *     summary: Create a new watchlist
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
 *                 example: "Horror Favorites"
 *               description:
 *                 type: string
 *                 example: "List of top horror movies for Halloween"
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60d5ecb8b3f1a2134421b882"]
 *               allowedTags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Slasher", "Psychological"]
 *     responses:
 *       201:
 *         description: Watchlist created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { title, description, collaborators, allowedTags } = createWatchlistSchema.parse(req.body);

    const watchlist = await Watchlist.create({
      title,
      description,
      owner: userId,
      collaborators,
      allowedTags,
      movies: [],
    });

    const populatedWatchlist = await Watchlist.findById(watchlist._id)
      .populate('owner', '_id username name profileUrl')
      .populate('collaborators', '_id username profileUrl');

    return res.status(201).json(populatedWatchlist);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/watchlists:
 *   get:
 *     tags: [Watchlists]
 *     summary: List all watchlists for the logged user (owned or collaborating)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of watchlists populated with owner and collaborators
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const watchlists = await Watchlist.find({
      $or: [{ owner: userId }, { collaborators: userId }],
      status: 'active'
    })
      .populate('owner', '_id username name profileUrl')
      .populate('collaborators', '_id username profileUrl')
      .populate('movies.addedBy', '_id username')
      .sort({ updatedAt: -1 });

    return res.json(watchlists);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/watchlists/{id}:
 *   put:
 *     tags: [Watchlists]
 *     summary: Synchronize the entire watchlist state
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Watchlist ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Horror Favorites"
 *               description:
 *                 type: string
 *                 example: "List of top horror movies for Halloween"
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["64fa..."]
 *               allowedTags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Slasher", "Classic"]
 *               movies:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - movieId
 *                     - watched
 *                   properties:
 *                     movieId:
 *                       type: string
 *                       example: "687..."
 *                     watched:
 *                       type: boolean
 *                       example: true
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Favorite"]
 *     responses:
 *       200:
 *         description: Watchlist synchronized successfully
 *       400:
 *         description: Validation error, duplicate movieIds, or non-existent movie
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not owner or collaborator
 *       404:
 *         description: Watchlist not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const watchlistId = req.params.id;

    // 1. Validação do body com Zod
    const { title, description, collaborators, allowedTags, movies } = syncWatchlistSchema.parse(req.body);

    // 2. Busca da Watchlist
    const watchlist = await Watchlist.findById(watchlistId);
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // 3. Verificação de permissões
    const isOwner = watchlist.owner.toString() === userId;
    const isCollaborator = watchlist.collaborators.some((c) => c.toString() === userId);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'You do not have permission to modify this watchlist' });
    }

    // 4. Aplicação de alterações de metadados conforme a role
    if (isOwner) {
      if (title !== undefined) watchlist.title = title;
      if (description !== undefined) watchlist.description = description;
      if (collaborators !== undefined) watchlist.collaborators = collaborators as any;
    }

    if (allowedTags !== undefined) {
      watchlist.allowedTags = allowedTags;
    }

    // 5. Atualização de filmes (APENAS se o campo `movies` foi enviado no body)
    if (movies !== undefined) {
      // 5.1. Validação dos movieIds (Duplicatas)
      const movieIds = movies.map((item) => item.movie);
      const uniqueMovieIds = Array.from(new Set(movieIds));

      if (uniqueMovieIds.length !== movieIds.length) {
        return res.status(400).json({ error: 'Duplicate movieIds are not allowed in the movies array' });
      }

      // 5.2. Consulta em lote no Mongo para os modelos Movie
      const movieDocs = await Movie.find({ _id: { $in: uniqueMovieIds } });

      if (movieDocs.length !== uniqueMovieIds.length) {
        return res.status(400).json({ error: 'One or more movies were not found in the database' });
      }

      const movieMap = new Map(movieDocs.map((doc) => [doc._id.toString(), doc]));

      // Map auxiliar para verificar o estado prévio dos filmes na watchlist
      const existingMoviesMap = new Map(
        watchlist.movies.map((item) => [item.movie.toString(), item])
      );

      // 5.3. Reconstrução de watchlist.movies
      watchlist.movies = movies.map((item, index) => {
        const movieDoc = movieMap.get(item.movie)!;
        const existingItem = existingMoviesMap.get(item.movie);

        if (existingItem) {
          // Mantém addedBy e addedAt originais
          return {
            _id: existingItem._id,
            movie: movieDoc._id,
            title: movieDoc.title,
            genres: movieDoc.genres || [],
            posterUrl: movieDoc.posterUrl || '',
            addedBy: existingItem.addedBy,
            addedAt: existingItem.addedAt,
            watched: item.watched,
            order: index,
            tags: item.tags,
          } as any;
        } else {
          // Novo item na watchlist
          return {
            movie: movieDoc._id,
            title: movieDoc.title,
            genres: movieDoc.genres || [],
            posterUrl: movieDoc.posterUrl || '',
            addedBy: userId,
            addedAt: new Date(),
            watched: item.watched,
            order: index,
            tags: item.tags,
          } as any;
        }
      });
    }

    // 6. Salvar no MongoDB
    await watchlist.save();

    // 7. Retorno com populações solicitadas
    const updatedWatchlist = await Watchlist.findById(watchlist._id)
      .populate('owner', '_id username name profileUrl')
      .populate('collaborators', '_id username profileUrl')
      .populate('movies.addedBy', '_id username');

    return res.status(200).json(updatedWatchlist);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/watchlists/{id}:
 *   delete:
 *     tags: [Watchlists]
 *     summary: Delete a watchlist (Strict Owner Only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Watchlist ID
 *     responses:
 *       200:
 *         description: Watchlist deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only the watchlist owner can delete this list
 *       404:
 *         description: Watchlist not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const watchlistId = req.params.id;

    const watchlist = await Watchlist.findById(watchlistId);

    // Considera "não encontrada" se não existir ou se já estiver excluída
    if (!watchlist || watchlist.status === 'excluded') {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    if (watchlist.owner.toString() !== userId) {
      return res.status(403).json({ error: 'Only the watchlist owner can delete this list' });
    }

    // Soft delete: altera o status para 'excluded'
    watchlist.status = 'excluded';
    await watchlist.save();

    return res.status(200).json({ message: 'Watchlist deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;