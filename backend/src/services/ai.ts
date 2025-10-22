import { prisma } from '../prisma';

type AskMode = 'local' | 'live';

export type AskInput = {
  userId: number;
  text: string;
  mode?: AskMode; // 'live' يستخدم OpenAI إذا عندك مفتاح
};

/**
 * نقطة الدخول الرئيسية: ترجع { reply } وتخزن الرسائل في DB
 */
export async function aiAsk({ userId, text, mode = 'local' }: AskInput) {
  const q = (text ?? '').trim();
  if (!q) return { reply: 'Please write your question.' };

  // 1) خزّن رسالة المستخدم
  await prisma.message.create({ data: { userId, role: 'user', text: q } });

  // 2) جهّز كونتكست بسيط من قاعدة البيانات
  const summary = await prisma.record.aggregate({
    where: { userId },
    _count: true,
    _sum: { value: true },
  });
  const ordersCount = await prisma.order.count({ where: { userId } });

  const context =
    `UserID=${userId} | Records=${summary._count} | ` +
    `RecordsTotal=${summary._sum.value ?? 0} | Orders=${ordersCount}`;

  // 3) اختر محرّك الرد
  const useLive = mode === 'live' && !!process.env.OPENAI_API_KEY;
  const reply = useLive
    ? await replyWithOpenAI(q, context)
    : await replyLocal(q, summary._count, summary._sum.value ?? 0, ordersCount, context);

  // 4) خزّن ردّ المساعد
  await prisma.message.create({ data: { userId, role: 'assistant', text: reply } });

  return { reply };
}

/** ردّ محلي بسيط يعتمد على كلمات مفتاحية وملخّص الداتا */
async function replyLocal(
  q: string,
  recordsCount: number,
  recordsTotal: number,
  orders: number,
  context: string,
) {
  const lower = q.toLowerCase();

  // أمثلة منطق بسيط — عدّل كما تحب
  if (/(yesterday|today|last|sales)/.test(lower)) {
    return `Local mode: I can't compute day-level sales yet, but your total value is ${recordsTotal} and you have ${orders} orders.`;
  }
  if (/orders|count/.test(lower)) {
    return `You have ${orders} orders and ${recordsCount} records in total.`;
  }

  return `You said: "${q}". Context → ${context}`;
}

/** رد عبر OpenAI */
async function replyWithOpenAI(question: string, context: string) {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Node 18+ عنده fetch مدمج. لو أقل، ثبّت node-fetch@3 واستورده.
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful restaurant analytics assistant. Be concise and numeric when possible.' },
          {
            role: 'user',
            content: `${question}\n\nContext (DB summary):\n${context}\n\nIf you estimate, clearly say it is an estimate.`,
          },
        ],
      }),
    });

    const j = (await r.json()) as any;

    const text: string | undefined = j?.choices?.[0]?.message?.content?.trim();
    return text || `I received your question: "${question}". (OpenAI returned no text.)`;
  } catch (e) {
    return `OpenAI error. Falling back. You asked: "${question}".`;
  }
}

/** سجل المحادثة لآخر N رسائل */
export async function aiHistory(userId: number, limit = 50) {
  const rows = await prisma.message.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows;
}
