import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { auth, requireAdmin } from '../middleware/auth';
import { makePasswordSig, validatePasswordBasic } from '../utils/password';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const adminCreateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager']).optional().default('manager'),
});

// الحد الأقصى لتكرار نفس كلمة السر
const MAX_PW_REUSE = 3;

/** POST /api/auth/login */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt }
    });
  } catch (e) { next(e); }
});

/** GET /api/auth/me */
router.get('/me', auth, async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: (req as any).user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });
  if (!me) return res.status(404).json({ error: 'Not found' });
  res.json(me);
});

/** POST /api/auth/admin/users (Admin only) */
router.post('/admin/users', auth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role } = adminCreateSchema.parse(req.body);

    // Email unique check
    const exist = await prisma.user.findUnique({ where: { email } });
    if (exist) return res.status(409).json({ error: 'Email already exists' });

    // Password rules
    const pwErr = validatePasswordBasic(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    // Reuse limit
    const sig = makePasswordSig(password);
    const reuseCount = await prisma.user.count({ where: { passwordSig: sig } });
    if (reuseCount >= MAX_PW_REUSE) {
      return res.status(400).json({ error: 'This password is used too many times. Please choose another.' });
    }

    const hashed = await bcrypt.hash(password, Number(process.env.BCRYPT_COST ?? 10));
    const created = await prisma.user.create({
      data: {
        name: name ?? email.split('@')[0],
        email,
        password: hashed,
        passwordSig: sig,
        role
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.status(201).json(created);
  } catch (e) { next(e); }
});

/** POST /api/auth/change-password */
router.post('/change-password', auth, async (req, res, next) => {
  try {
    const schema = z.object({
      current: z.string().min(1),
      next: z.string().min(6),
      confirm: z.string().min(6)
    });
    const { current, next, confirm } = schema.parse(req.body);
    if (next !== confirm) return res.status(400).json({ error: 'Passwords do not match' });

    const user = await prisma.user.findUnique({ where: { id: (req as any).user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(current, user.password);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const pwErr = validatePasswordBasic(next);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const sig = makePasswordSig(next);
    const reuseCount = await prisma.user.count({ where: { passwordSig: sig } });
    if (reuseCount >= MAX_PW_REUSE) {
      return res.status(400).json({ error: 'This password is used too many times. Please choose another.' });
    }

    const hashed = await bcrypt.hash(next, Number(process.env.BCRYPT_COST ?? 10));
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordSig: sig }
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
