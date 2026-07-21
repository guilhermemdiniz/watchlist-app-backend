// backend/src/models/Movie.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IMovie extends Document {
  title: string;
  year?: number;
  director?: string;
  synopsis?: string;
  posterUrl?: string;
  sourceUrl?: string;
  letterboxdSlug?: string;
  genres: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MovieSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    year: { type: Number },
    director: { type: String, trim: true },
    synopsis: { type: String, trim: true },
    posterUrl: { type: String, trim: true },
    sourceUrl: { type: String, trim: true, index: true },
    letterboxdSlug: { type: String, trim: true, index: true },
    genres: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

export const Movie = mongoose.model<IMovie>('Movie', MovieSchema);