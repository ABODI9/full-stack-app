import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { makePasswordSig, validatePasswordBasic } from '../utils/password';

const prisma = new PrismaClient();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional()
});

type DbUser = {
  id: number;
  email: string;
  role: string;
  name: string | null;
};

type AuthPayload = {
  token: string;
  user: { id: number; email: string; name: string | null; role: string };
};

export async function register(body: unknown): Promise<AuthPayload> {
  const { email, password, name } = authSchema.parse(body);

  // لا تكرار إيميل
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error('Email already registered');

  // قواعد بسيطة للباسورد
  const pwErr = validatePasswordBasic(password);
  if (pwErr) throw new Error(pwErr);

  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_COST ?? 10));
  const sig  = makePasswordSig(password);

  // 👈 مهم: نكتب passwordSig
  const user = await prisma.user.create({
    data: { email, name: name ?? email.split('@')[0], password: hash, passwordSig: sig }
  });

  return tokenPayload(user);
}

export async function login(body: unknown): Promise<AuthPayload> {
  const { email, password } = authSchema.pick({ email: true, password: true }).parse(body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid credentials');

  const ok = await bcrypt.compare(password, (user as any).password);
  if (!ok) throw new Error('Invalid credentials');

  return tokenPayload(user);
}

function tokenPayload(user: DbUser): AuthPayload {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}
