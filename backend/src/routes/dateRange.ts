export function parseRange(q: any) {
  const from = q?.from ? new Date(q.from) : undefined;
  const to   = q?.to   ? new Date(q.to)   : undefined;
  if (from && isNaN(+from)) throw new Error('Invalid from date');
  if (to && isNaN(+to)) throw new Error('Invalid to date');
  return { from, to };
}
