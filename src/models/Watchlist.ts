// backend/src/models/Watchlist.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IWatchlistMovieItem {
  _id?: Types.ObjectId;
  movie: Types.ObjectId;
  title: string;
  addedBy: Types.ObjectId;
  addedAt: Date;
  watched: boolean;
  order: number;
  tags: string[];
  genres: string[];
  posterUrl: string;
}

export interface IWatchlist extends Document {
  title: string;
  description: string;
  owner: Types.ObjectId;
  collaborators: Types.ObjectId[];
  allowedTags: string[];
  movies: IWatchlistMovieItem[];
  status: 'active' | 'excluded';
  createdAt: Date;
  updatedAt: Date;
}

const WatchlistMovieItemSchema = new Schema<IWatchlistMovieItem>({
  movie: { type: Schema.Types.ObjectId, ref: 'Movie', required: true },
  title: { type: String, required: true },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
  watched: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  tags: [{ type: String, trim: true }],
  genres: [{ type: String, trim: true }],
  posterUrl: { type: String, trim: true, default: '' },
});

const WatchlistSchema = new Schema<IWatchlist>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    allowedTags: [{ type: String, trim: true }],
    movies: [WatchlistMovieItemSchema],
    status: {
      type: String,
      enum: ['active', 'excluded'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

export const Watchlist = model<IWatchlist>('Watchlist', WatchlistSchema);