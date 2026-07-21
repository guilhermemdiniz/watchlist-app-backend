// backend/src/routes/watchlistRoutes.ts
import { Router, Response } from 'express';
import { z } from 'zod';
import { Watchlist } from '../models/Watchlist';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// Schemas de Validação
const createWatchlistSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  collaborators: z.array(z.string()).optional().default([]),
  allowedTags: z.array(z.string()).optional().default([]),
});

const updateWatchlistSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  allowedTags: z.array(z.string()).optional(),
});

const addMovieSchema = z.object({
  movieId: z.string().min(1, 'Movie ID is required'),
  genres: z.array(z.string()).optional().default([]),
  posterUrl: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
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
 * /api/watchlists/{id}/movies:
 *   post:
 *     tags: [Watchlists]
 *     summary: Add a movie to a watchlist
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
 *             required:
 *               - movieId
 *             properties:
 *               movieId:
 *                 type: string
 *                 example: "60d5ecb8b3f1a2134421b999"
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Drama", "Thriller"]
 *               posterUrl:
 *                 type: string
 *                 example: "https://image.tmdb.org/t/p/w500/sample.jpg"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Must Watch"]
 *     responses:
 *       200:
 *         description: Movie added to watchlist successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not owner or collaborator
 *       404:
 *         description: Watchlist not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/movies', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const watchlistId = req.params.id;
    const { movieId, genres, posterUrl, tags } = addMovieSchema.parse(req.body);

    const watchlist = await Watchlist.findById(watchlistId);
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const isOwner = watchlist.owner.toString() === userId;
    const isCollaborator = watchlist.collaborators.some((c) => c.toString() === userId);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'You do not have permission to modify this watchlist' });
    }

    const newMovieItem = {
      movie: movieId,
      addedBy: userId,
      addedAt: new Date(),
      watched: false,
      order: watchlist.movies.length,
      tags,
      genres,
      posterUrl,
    };

    const updatedWatchlist = await Watchlist.findByIdAndUpdate(
      watchlistId,
      { $push: { movies: newMovieItem } },
      { new: true }
    )
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
 * /api/watchlists/{id}/movies/{movieId}:
 *   delete:
 *     tags: [Watchlists]
 *     summary: Remove a movie from a watchlist
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Watchlist ID
 *       - in: path
 *         name: movieId
 *         required: true
 *         schema:
 *           type: string
 *         description: Movie item subdocument ID
 *     responses:
 *       200:
 *         description: Movie removed from watchlist successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not owner or collaborator
 *       404:
 *         description: Watchlist not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/movies/:movieId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { id: watchlistId, movieId } = req.params;

    const watchlist = await Watchlist.findById(watchlistId);
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const isOwner = watchlist.owner.toString() === userId;
    const isCollaborator = watchlist.collaborators.some((c) => c.toString() === userId);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'You do not have permission to modify this watchlist' });
    }

    const updatedWatchlist = await Watchlist.findByIdAndUpdate(
      watchlistId,
      { $pull: { movies: { _id: movieId } } },
      { new: true }
    )
      .populate('owner', '_id username name profileUrl')
      .populate('collaborators', '_id username profileUrl')
      .populate('movies.addedBy', '_id username');

    return res.status(200).json(updatedWatchlist);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/watchlists/{id}:
 *   patch:
 *     tags: [Watchlists]
 *     summary: Update watchlist metadata or items status
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
 *               description:
 *                 type: string
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedTags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Watchlist updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not owner or collaborator
 *       404:
 *         description: Watchlist not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const watchlistId = req.params.id;
    const updateData = updateWatchlistSchema.parse(req.body);

    const watchlist = await Watchlist.findById(watchlistId);
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const isOwner = watchlist.owner.toString() === userId;
    const isCollaborator = watchlist.collaborators.some((c) => c.toString() === userId);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'You do not have permission to modify this watchlist' });
    }

    const updatedWatchlist = await Watchlist.findByIdAndUpdate(
      watchlistId,
      { $set: updateData },
      { new: true }
    )
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
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    if (watchlist.owner.toString() !== userId) {
      return res.status(403).json({ error: 'Only the watchlist owner can delete this list' });
    }

    await Watchlist.findByIdAndDelete(watchlistId);
    return res.status(200).json({ message: 'Watchlist deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;