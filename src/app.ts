// src/app.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import { setupSwagger } from './config/swagger';
import authRoutes from './routes/authRoutes';
import movieRoutes from './routes/movieRoutes';
import watchlistRoutes from './routes/watchlistRoutes';
import userRoutes from './routes/userRoutes';

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
  })
);

app.use(express.json());

// Database
connectDB();

// Docs
setupSwagger(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/watchlists', watchlistRoutes);
app.use('/api/user', userRoutes);

export default app;