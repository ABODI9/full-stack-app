import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

export async function ask(userId: number, text: string) {
  if (!text || !text.trim()) return { reply: 'اكتب سؤالك.' };

  // اجلب بعض الأرقام من الداتا لتعزيز الإجابة
  const summary = await prisma.record.aggregate({ where: { userId }, _sum: { value: true }, _count: true });
  const context = `User has ${summary._count} records with total value ${summary._sum.value ?? 0}.`;

  let reply = `You asked: "${text}". ${context}`;

  // (اختياري) استدعاء GPT إذا لديك API Key
  if (process.env.OPENAI_API_KEY) {
    try {
      const gpt = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful data assistant.' },
            { role: 'user', content: `${text}\n\nContext:\n${context}` }
          ]
        })
      }).then(r => r.json() as any);
      reply = gpt.choices?.[0]?.message?.content ?? reply;
    } catch { /* fallback to local reply */ }
  }

  await prisma.message.create({ data: { text, role: 'user', userId } });
  await prisma.message.create({ data: { text: reply, role: 'assistant', userId } });

  return { reply };
}
