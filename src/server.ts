// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import { setupSwagger } from './config/swagger';
import authRoutes from './routes/authRoutes';
import movieRoutes from './routes/movieRoutes';
import watchlistRoutes from './routes/watchlistRoutes';

const app = express();
const PORT = Number(process.env.PORT) || 3333;

// Configuração explícita do CORS para desenvolvimento e dispositivos mobile
app.use(
  cors({
    origin: '*', // Permite qualquer origem (celular, emulador, web)
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

// O host '0.0.0.0' garante que o contêiner Docker escute tanto requisições locais do container quanto da rede externa (seu Wi-Fi)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});