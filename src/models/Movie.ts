// backend/src/models/Movie.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IMovie extends Document {
  letterboxdSlug?: string;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  posterUrl?: string;
  coverUrl?: string;
  sourceUrl?: string;
  description?: string;
  genres: string[];
  rating?: number;
}

const MovieSchema = new Schema<IMovie>(
  {
    letterboxdSlug: { type: String, unique: true, sparse: true },
    imdbId: { type: String, unique: true, sparse: true },
    title: { type: String, required: true },
    originalTitle: { type: String },
    posterUrl: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    sourceUrl: { type: String, unique: true, sparse: true, index: true },
    description: { type: String, default: '' },
    genres: [{ type: String }],
    rating: { type: Number },
  },
  { timestamps: true }
);

export const Movie = mongoose.model<IMovie>('Movie', MovieSchema);