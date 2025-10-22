import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { aiAsk, aiHistory } from '../services/ai';

const router = Router();

/** POST /api/ai/ask  { text: string, mode?: 'local'|'live' } */
router.post('/ask', requireAuth, async (req: AuthRequest<{ text?: string; mode?: 'local'|'live' }>, res, next) => {
  try {
    const userId = req.user!.id;
    const text = String(req.body?.text ?? '');
    const mode = (req.body?.mode === 'live' ? 'live' : 'local');

    const data = await aiAsk({ userId, text, mode });
    res.json(data);
  } catch (e) { next(e); }
});

/** GET /api/ai/history?limit=50 */
router.get('/history', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const limit = Number(req.query.limit ?? 50);
    const rows = await aiHistory(userId, Math.max(1, Math.min(200, limit)));
    res.json({ rows });
  } catch (e) { next(e); }
});

export default router;
