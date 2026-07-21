// backend/src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  lastname?: string;
  username: string;
  email: string;
  password?: string;
  bio?: string;
  profileUrl?: string;
}

const UserSchema: Schema = new Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    lastname: { 
      type: String, 
      trim: true 
    },
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-zA-Z0-9._]+$/,
        'Username can only contain alphanumeric characters, dots (.), and underscores (_)',
      ],
      index: true,
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true,
      index: true,
    },
    password: { 
      type: String, 
      required: true 
    },
    bio: { 
      type: String, 
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    profileUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Sanitiza a saída do usuário removendo a senha
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export const User = mongoose.model<IUser>('User', UserSchema);