import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { auth, requireAdmin } from '../middleware/auth';
import { makePasswordSig } from '../utils/password';


const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// ✅ إلغاء التسجيل المفتوح (احذفه نهائيًا أو علّق عليه)
// router.post('/register', ...)

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
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) { next(e); }
});

// ✅ معلومات المستخدم الحالي
router.get('/me', auth, async (req, res, next) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: (req as any).user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    if (!me) return res.status(404).json({ error: 'Not found' });
    res.json(me);
  } catch (e) { next(e); }
});

// ✅ إنشاء مستخدم بواسطة الأدمن فقط
const adminCreateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin','user']).optional().default('user')
});

router.post('/admin/users', auth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role } = adminCreateSchema.parse(req.body);

    const exist = await prisma.user.findUnique({ where: { email } });
    if (exist) return res.status(409).json({ error: 'Email already exists' });

    const rounds = Number(process.env.BCRYPT_COST ?? 10);
    const hashed = await bcrypt.hash(password, rounds);
    const sig = makePasswordSig(password);   // 👈 NEW

    const created = await prisma.user.create({
      data: {
        name: name ?? email.split('@')[0],
        email,
        password: hashed,
        passwordSig: sig,                    // 👈 NEW (مطلوب من Prisma)
        role
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.status(201).json(created);
  } catch (e) { next(e); }
});


export default router;
