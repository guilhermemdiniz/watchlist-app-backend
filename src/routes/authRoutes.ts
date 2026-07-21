// backend/src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Regex: aceita apenas letras, números, ponto (.) e underline (_)
const usernameRegex = /^[a-zA-Z0-9._]+$/;

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  lastname: z.string().optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(usernameRegex, 'Username can only contain alphanumeric characters, dots (.), and underscores (_)'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
});

const loginSchema = z.object({
  // Permite e-mail ou username no campo 'login'
  login: z.string().min(1, 'Email or Username is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John"
 *               lastname:
 *                 type: string
 *                 example: "Doe"
 *               username:
 *                 type: string
 *                 example: "cinephile_99"
 *               email:
 *                 type: string
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "secret123"
 *               bio:
 *                 type: string
 *                 example: "Movie enthusiast and Letterboxd fan."
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     lastname:
 *                       type: string
 *                       nullable: true
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                     profileUrl:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Validation error or duplicated credentials
 *       500:
 *         description: Internal server error
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, lastname, username, email, password, bio } = registerSchema.parse(req.body);

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Verifica se já existe um usuário com o mesmo e-mail ou username
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      if (existingUser.email === cleanEmail) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      lastname,
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      bio,
    });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        lastname: user.lastname,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profileUrl: user.profileUrl,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user with email or username
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *               - password
 *             properties:
 *               login:
 *                 type: string
 *                 description: User's email address or username
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     lastname:
 *                       type: string
 *                       nullable: true
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                     profileUrl:
 *                       type: string
 *                       nullable: true
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = loginSchema.parse(req.body);

    const cleanLogin = login.toLowerCase().trim();

    // Busca por e-mail OU username
    const user = await User.findOne({
      $or: [{ email: cleanLogin }, { username: cleanLogin }],
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        lastname: user.lastname,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profileUrl: user.profileUrl,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;