import { Request, Response } from 'express';
import crypto from 'crypto';
import { Watchlist } from '../models/Watchlist';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. Gerar Token de Compartilhamento
export const generateShareLink = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;

  const watchlist = await Watchlist.findById(id);

  if (!watchlist) {
    return res.status(404).json({ message: 'Watchlist não encontrada' });
  }

  // Verifica se quem está gerando é o dono
  if (watchlist.owner.toString() !== userId) {
    return res.status(403).json({ message: 'Apenas o proprietário pode gerar o link.' });
  }

  // Se já tiver token, reutiliza; se não, gera um token aleatório seguro
  if (!watchlist.shareToken) {
    watchlist.shareToken = crypto.randomBytes(16).toString('hex');
    await watchlist.save();
  }

  const shareUrl = `${process.env.APP_FRONTEND_URL}/join/${watchlist.shareToken}`;

  return res.status(200).json({ shareToken: watchlist.shareToken, shareUrl });
};

// 2. Obter dados públicos para a tela de preview do convite
export const getWatchlistByToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  const watchlist = await Watchlist.findOne({ shareToken: token })
    .populate('owner', 'name username email profileUrl')
    .populate('collaborators', 'name username email profileUrl')
    .select('title description owner collaborators movies');

  if (!watchlist) {
    return res.status(404).json({ message: 'Link de convite inválido ou expirado' });
  }

  return res.status(200).json(watchlist);
};

// 3. Entrar na Watchlist como Colaborador
export const joinWatchlist = async (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const userId = req.userId;

  const watchlist = await Watchlist.findOne({ shareToken: token });

  if (!watchlist) {
    return res.status(404).json({ message: 'Link de convite inválido' });
  }

  // Impede que o dono se adicione como colaborador
  if (watchlist.owner.toString() === userId) {
    return res.status(400).json({ message: 'Você já é o proprietário desta watchlist' });
  }

  // $addToSet evita duplicatas no array do MongoDB nativamente
  await Watchlist.updateOne(
    { _id: watchlist._id },
    { $addToSet: { collaborators: userId } }
  );

  return res.status(200).json({ message: 'Você agora é um colaborador desta watchlist!' });
};