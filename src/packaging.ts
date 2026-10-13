const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const PACKAGING_RULES = [
  "Frascos (10ml)",
  "Caixas (decantes)",
  "Envelopes decantes",
  "Papel de seda",
  "Saco organza",
  "Carta de agradecimento",
  "Cartão de visita",
  "Envelope APC",
  "Sacolas DAF",
] as const;

type SaleForPackaging = {
  status?: string;
  items: { ml: number; isApc?: boolean }[];
  supplyOverrides?: Record<string, number>;
};

type SupplyForPackaging = {
  name: string;
  cost?: number;
  attachCost?: boolean;
};

export function automaticPackaging(sale: SaleForPackaging) {
  const bottles = sale.items.reduce(
    (total, item) =>
      total +
      (item.isApc && item.ml > 10 ? 0 : Math.ceil(Math.max(0, item.ml) / 10)),
    0,
  );
  const boxes = Math.ceil(bottles / 8);
  const hasApc = sale.items.some((item) => item.isApc);

  return {
    "Frascos (10ml)": bottles,
    "Caixas (decantes)": boxes,
    "Envelopes decantes": boxes,
    "Papel de seda": hasApc ? 0 : boxes,
    "Saco organza": Math.ceil(bottles / 3),
    "Carta de agradecimento": 1,
    "Cartão de visita": 1,
    "Envelope APC": sale.items.filter((item) => item.isApc).length,
    "Sacolas DAF": 0,
  } satisfies Record<(typeof PACKAGING_RULES)[number], number>;
}

export function packagingOptions(
  sale: SaleForPackaging,
  supplies: SupplyForPackaging[],
) {
  const automatic = automaticPackaging(sale);
  const names = [
    ...PACKAGING_RULES,
    ...supplies.filter((supply) => supply.attachCost).map((supply) => supply.name),
    ...Object.keys(sale.supplyOverrides || {}),
  ];
  const unique = new Map<string, string>();
  names.forEach((name) => {
    const normalized = key(name);
    if (!unique.has(normalized)) unique.set(normalized, name);
  });
  return [...unique.values()].map((name) => {
    const fixedName = PACKAGING_RULES.find((rule) => key(rule) === key(name));
    const attached = supplies.some(
      (supply) => supply.attachCost && key(supply.name) === key(name),
    );
    return {
      name,
      automaticQty: fixedName ? automatic[fixedName] : attached ? 1 : 0,
    };
  });
}

export function packaging(
  sale: SaleForPackaging,
  supplies: SupplyForPackaging[],
) {
  if (sale.status === "cancelled") return { total: 0, lines: [], missing: [] };

  const options = packagingOptions(sale, supplies);
  const lines = options
    .map(({ name, automaticQty }) => {
      const qty = Math.max(
        0,
        Number(sale.supplyOverrides?.[name] ?? automaticQty),
      );
      const supply = supplies.find((item) => key(item.name) === key(name));
      return {
        name,
        qty,
        automaticQty,
        unitCost: supply?.cost || 0,
        missing: !supply || supply.cost == null,
        total: qty * (supply?.cost || 0),
      };
    })
    .filter((line) => line.qty > 0);

  return {
    lines,
    missing: lines.filter((line) => line.missing).map((line) => line.name),
    total: lines.reduce((total, line) => total + line.total, 0),
  };
}
