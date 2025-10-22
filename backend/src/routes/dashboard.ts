import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { parseRange } from './dateRange';
import { prisma } from '../prisma';

const r = Router();

/** GET /api/dashboard/records?from&to
 * Returns raw orders for the authed user within the range
 */
r.get('/records', requireAuth, async (req: AuthRequest, res) => {
  const { from, to } = parseRange(req.query);
  const where: any = { userId: req.user!.id };
  if (from || to) where.insertdate = {};
  if (from) where.insertdate.gte = from;
  if (to)   where.insertdate.lte = to;

  const rows = await prisma.order.findMany({
    where,
    orderBy: { insertdate: 'asc' }
  });
  res.json(rows);
});

/** GET /api/dashboard/summary?from&to
 * Basic KPIs + simple daily line for the range
 */
r.get('/summary', requireAuth, async (req: AuthRequest, res) => {
  const { from, to } = parseRange(req.query);
  const where: any = { userId: req.user!.id };
  if (from || to) where.insertdate = {};
  if (from) where.insertdate.gte = from;
  if (to)   where.insertdate.lte = to;

  const orders = await prisma.order.findMany({ where });
  const totalSales = orders.reduce((s, o) => s + Number(o.ordertotal ?? 0), 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders ? Math.round(totalSales / totalOrders) : 0;

  // group by day for a simple line
  const daily = new Map<string, number>();
  for (const o of orders) {
    const k = o.insertdate.toISOString().slice(0, 10);
    daily.set(k, (daily.get(k) ?? 0) + Number(o.ordertotal ?? 0));
  }
  const lineDaily = [...daily.entries()]
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([,v])=> Math.round(v));

  res.json({
    kpis: [
      { label: 'Total Sales', value: Math.round(totalSales), delta: 0, color: '#c9cc7b' },
      { label: 'Total Orders', value: totalOrders,            delta: 0, color: '#8be1ea' },
      { label: 'Total Customers', value: 0,                   delta: 0, color: '#89c1ff' }, // fill if you have a customer table
      { label: 'Avg. Order Value', value: avgOrder,           delta: 0, color: '#d7a3e6' },
    ],
    lineDaily,
    valueDist: [],   // can be filled by channel distribution later
    countDist: []
  });
});

export default r;
