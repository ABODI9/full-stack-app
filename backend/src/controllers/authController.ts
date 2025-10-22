import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional()
});

export async function register(body: unknown) {
  const { email, password, name } = authSchema.parse(body);
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error('Email already registered');
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name: name ?? email.split('@')[0], password: hash } });
  return tokenPayload(user);
}

export async function login(body: unknown) {
  const { email, password } = authSchema.pick({ email: true, password: true }).parse(body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');
  return tokenPayload(user);
}

function tokenPayload(user: { id: number; email: string; role: string; name: string }) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
