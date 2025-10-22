import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/** GET /api/analytics/summary?date=YYYY-MM-DD */
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const date = (req.query.date?.toString() ?? dayjs().format('YYYY-MM-DD'));
    const from = dayjs(date).startOf('day').toDate();
    const to = dayjs(date).endOf('day').toDate();

    const [agg, uniqueCustomers] = await Promise.all([
      prisma.order.aggregate({
        _sum:  { ordertotal: true },
        _count:{ id: true },
        _avg:  { ordertotal: true },
        where: { insertdate: { gte: from, lte: to }, ordertotal: { not: null } }
      }),
      prisma.order.findMany({
        select: { customerid: true },
        distinct: ['customerid'],
        where: { insertdate: { gte: from, lte: to } }
      })
    ]);

    res.json({
      date,
      totalRevenue: Number(agg._sum.ordertotal ?? 0),
      orderCount:   agg._count.id,
      averageOrder: Number(agg._avg.ordertotal ?? 0),
      customerCount: uniqueCustomers.filter(c => c.customerid != null).length || null
    });
  } catch (e) { next(e); }
});

/** GET /api/analytics/hourly?date=YYYY-MM-DD */
router.get('/hourly', requireAuth, async (req, res, next) => {
  try {
    const date = (req.query.date?.toString() ?? dayjs().format('YYYY-MM-DD'));
    const from = dayjs(date).startOf('day').toDate();
    const to = dayjs(date).endOf('day').toDate();

    const rows = await prisma.$queryRaw<
      { hour: number; orderCount: bigint; totalRevenue: number }[]
    >`
      SELECT EXTRACT(hour from "insertdate")::int as hour,
             COUNT(*)::bigint as "orderCount",
             SUM("ordertotal")::float as "totalRevenue"
      FROM "orders"  -- ← الجدول الفعلي
      WHERE "insertdate" BETWEEN ${from} AND ${to}
        AND "ordertotal" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    res.json(rows.map(r => ({
      hour:        Number(r.hour),
      orderCount:  Number(r.orderCount),
      totalRevenue:Number(r.totalRevenue),
    })));
  } catch (e) { next(e); }
});

/** GET /api/analytics/platforms?date=YYYY-MM-DD */
router.get('/platforms', requireAuth, async (req, res, next) => {
  try {
    const date = (req.query.date?.toString() ?? dayjs().format('YYYY-MM-DD'));
    const from = dayjs(date).startOf('day').toDate();
    const to = dayjs(date).endOf('day').toDate();

    const rows = await prisma.order.groupBy({
      by: ['externalappname'],
      _sum: { ordertotal: true },
      where: { insertdate: { gte: from, lte: to }, externalappname: { not: null } },
      orderBy: { _sum: { ordertotal: 'desc' } }
    });

    res.json(rows.map(r => ({
      platform: r.externalappname,
      totalRevenue: Number(r._sum.ordertotal ?? 0),
    })));
  } catch (e) { next(e); }
});

/** GET /api/analytics/compare?d1=YYYY-MM-DD&d2=YYYY-MM-DD */
router.get('/compare', requireAuth, async (req, res, next) => {
  try {
    const d1 = req.query.d1?.toString();
    const d2 = req.query.d2?.toString();

    const fetchSum = async (d?: string) => {
      if (!d) return 0;
      const from = dayjs(d).startOf('day').toDate();
      const to = dayjs(d).endOf('day').toDate();
      const agg = await prisma.order.aggregate({
        _sum: { ordertotal: true },
        where: { insertdate: { gte: from, lte: to }, ordertotal: { not: null } }
      });
      return Number(agg._sum.ordertotal ?? 0);
    };

    const [r1, r2] = await Promise.all([fetchSum(d1), fetchSum(d2)]);
    const change = r1 && r2 ? ((r2 - r1) / (r1 || 1)) * 100 : null;

    res.json({ d1, revenue1: r1, d2, revenue2: r2, percentageChange: change });
  } catch (e) { next(e); }
});

/** GET /api/analytics/customer-map?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get('/customer-map', requireAuth, async (req, res, next) => {
  try {
    const from = dayjs(req.query.from?.toString() ?? dayjs().subtract(7, 'day')).startOf('day').toDate();
    const to = dayjs(req.query.to?.toString() ?? dayjs()).endOf('day').toDate();

    const rows = await prisma.order.findMany({
      select: { id: true, ordertotal: true, insertdate: true, lat: true, lng: true, customerid: true, externalappname: true },
      where: { insertdate: { gte: from, lte: to } }
    });

    res.json(rows.map(r => ({
      ...r,
      ordertotal: r.ordertotal ? Number(r.ordertotal) : null
    })));
  } catch (e) { next(e); }
});

export default router;
