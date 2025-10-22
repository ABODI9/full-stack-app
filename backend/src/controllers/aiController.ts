import { prisma } from '../prisma';
import fetch from 'node-fetch'; // نضمن fetch + الأنواع في Node

type AskOptions = {
  userId: number;
  text: string;           // سنقبل text أو prompt من الراوتر
};

/**
 * Returns { reply } using OpenAI if available, or a local fallback.
 * Also persists both user + assistant messages.
 */
export async function handleAsk({ userId, text }: AskOptions) {
  const q = (text || '').trim();
  if (!q) return { reply: 'Please write your question.' };

  // Store user message first
  await prisma.message.create({ data: { userId, role: 'user', text: q } });

  // Build a small context from DB
  const summary = await prisma.record.aggregate({
    where: { userId },
    _count: true,
    _sum: { value: true },
  });
  const ordersCount = await prisma.order.count({ where: { userId } });
  const context = [
    `UserID: ${userId}`,
    `Records: ${summary._count}`,
    `RecordsTotal: ${summary._sum.value ?? 0}`,
    `Orders: ${ordersCount}`,
  ].join(' | ');

  let reply: string;

  if (process.env.OPENAI_API_KEY) {
    // --- OpenAI path ---
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const body = {
      model,
      messages: [
        { role: 'system', content: 'You are a helpful restaurant analytics assistant.' },
        { role: 'user', content: `${q}\n\nContext:\n${context}` },
      ],
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const j = (await r.json()) as any;
    reply = j?.choices?.[0]?.message?.content?.trim();
    if (!reply) reply = `I received your question: "${q}". (OpenAI returned no text.)`;
  } else {
    // --- Local fallback path ---
    const lower = q.toLowerCase();
    if (lower.includes('total') && lower.includes('sales')) {
      reply = `Your total recorded value is ${summary._sum.value ?? 0}. Orders in DB: ${ordersCount}.`;
    } else if (lower.includes('records') || lower.includes('count')) {
      reply = `You have ${summary._count} records.`;
    } else {
      reply = `You said: "${q}". Context → ${context}`;
    }
  }

  // Persist assistant message
  await prisma.message.create({ data: { userId, role: 'assistant', text: reply } });

  return { reply };
}

/** Returns last N chat messages for a user (newest first). */
export async function getHistory(userId: number, limit = 50) {
  const rows = await prisma.message.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows;
}
