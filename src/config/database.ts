// src/config/database.ts
import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    console.log('=> Usando conexão existente com o MongoDB');
    return;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('A variável de ambiente MONGO_URI não está definida.');
  }

  try {
    const db = await mongoose.connect(mongoUri);
    
    isConnected = db.connections[0].readyState === 1; 
    console.log('🚀 Conectado com sucesso ao MongoDB');
  } catch (error) {
    console.error('❌ Erro ao conectar no MongoDB:', error);
  }
};