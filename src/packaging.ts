const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function packaging(sale: {status?: string; items: {ml: number; isApc?: boolean}[]}, supplies: {name: string; cost?: number}[]) {
  if (sale.status === 'cancelled') return {total: 0, lines: [], missing: []};
  const bottles = sale.items.reduce((n, item) => n + (item.isApc && item.ml > 10 ? 0 : Math.ceil(Math.max(0, item.ml) / 10)), 0);
  const boxes = Math.ceil(bottles / 8);
  const rules: [string, number][] = [['Frascos (10ml)', bottles], ['Caixas (decantes)', boxes], ['Envelopes decantes', boxes], ['Carta de agradecimento', 1], ['Cartão de visita', 1]];
  const lines = rules.filter(([,qty]) => qty > 0).map(([name, qty]) => {
    const supply = supplies.find(s => key(s.name) === key(name));
    return {name, qty, unitCost: supply?.cost || 0, missing: !supply || supply.cost == null, total: qty * (supply?.cost || 0)};
  });
  return {lines, missing: lines.filter(l => l.missing).map(l => l.name), total: lines.reduce((n,l) => n + l.total, 0)};
}
