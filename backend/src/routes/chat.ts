import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();
type ChatBody = { text: string };

router.post('/', requireAuth, async (req: AuthRequest<ChatBody>, res, next) => {
  try {
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.json({ reply: 'اكتب سؤالك.' });

    const userId = req.user!.id;

    if (text.toLowerCase().includes('count')) {
      const count = await prisma.record.count({ where: { userId } });
      return res.json({ reply: `There are ${count} records in the dataset.` });
    }

    const summary = await prisma.record.aggregate({
      where: { userId },
      _sum: { value: true },
      _count: true,
    });

    const reply = `You said: "${text}". You have ${summary._count} records. Total=${summary._sum.value ?? 0}.`;

    await prisma.message.create({ data: { text, role: 'user', userId } });
    await prisma.message.create({ data: { text: reply, role: 'assistant', userId } });

    res.json({ reply });
  } catch (e) { next(e); }
});

export default router;
