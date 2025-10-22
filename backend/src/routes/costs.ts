import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  date: z.string().or(z.date()).transform(v => new Date(v as any)),
  items: z.string().min(1),
  amount: z.number().nonnegative(),
});

type CostBody = z.infer<typeof createSchema>;

router.post('/', requireAuth, async (req: AuthRequest<CostBody>, res, next) => {
  try {
    const { date, items, amount } = createSchema.parse(req.body);
    const entry = await prisma.costEntry.create({
      data: { date, items, amount, userId: req.user?.id },
    });
    res.json({ ...entry, amount: Number(entry.amount) });
  } catch (e) { next(e); }
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const entries = await prisma.costEntry.findMany({
      where: { userId: req.user?.id },
      orderBy: { date: 'desc' },
      take: 50,
    });
    res.json(entries.map(e => ({ ...e, amount: Number(e.amount) })));
  } catch (e) { next(e); }
});

export default router;
