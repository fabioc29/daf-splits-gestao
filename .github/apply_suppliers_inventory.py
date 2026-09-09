from pathlib import Path

app_path = Path("src/App.tsx")
css_path = Path("src/index.css")
packaging_path = Path("src/packaging.ts")
app = app_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global app
    if old not in app:
        raise SystemExit(f"Pattern not found: {label}")
    app = app.replace(old, new, 1)


replace_once("  Users,\n  Wallet,", "  Users,\n  Building2,\n  Wallet,", "Building2 import")
replace_once(
    'import { automaticPackaging, packaging, PACKAGING_RULES } from "./packaging";',
    'import { automaticPackaging, packaging, packagingOptions, PACKAGING_RULES } from "./packaging";',
    "packagingOptions import",
)
replace_once(
    """  attachCost: boolean;
  cost?: number;
};""",
    """  attachCost: boolean;
  cost?: number;
  pendingLots?: {
    purchaseId: number;
    qty: number;
    cost: number;
    unit?: string;
  }[];
};""",
    "pending supply lots type",
)

replace_once(
    """function moveSupplyStock(supplies: S[], sale: V, direction: -1 | 1) {
  if (isHistoricalSale(sale)) return supplies;
  const usage = packaging(sale, supplies).lines;
  return supplies.map((supply) => {
    const line = usage.find(
      (item) => supplyStockKey(item.name) === supplyStockKey(supply.name),
    );
    return line
      ? {
          ...supply,
          stock: supply.stock + direction * line.qty,
        }
      : supply;
  });
}
""",
    """function activateNextSupplyLot(supply: S): S {
  let stock = Math.max(0, Number(supply.stock) || 0);
  let cost = Number(supply.cost || 0);
  const pendingLots = [...(supply.pendingLots || [])].map((lot) => ({
    ...lot,
    qty: Math.max(0, Number(lot.qty) || 0),
    cost: Math.max(0, Number(lot.cost) || 0),
  }));
  while (stock <= 0 && pendingLots.length) {
    const next = pendingLots.shift()!;
    if (next.qty <= 0) continue;
    stock = next.qty;
    cost = next.cost;
  }
  return { ...supply, stock, cost, pendingLots };
}
function consumeSupplyStock(supply: S, quantity: number): S {
  let current = activateNextSupplyLot(supply);
  let stock = current.stock;
  let cost = Number(current.cost || 0);
  const pendingLots = [...(current.pendingLots || [])];
  let remaining = Math.max(0, quantity);
  while (remaining > 0) {
    if (stock <= 0) {
      const next = pendingLots.shift();
      if (!next) break;
      stock = Math.max(0, Number(next.qty) || 0);
      cost = Math.max(0, Number(next.cost) || 0);
      continue;
    }
    const used = Math.min(stock, remaining);
    stock -= used;
    remaining -= used;
  }
  if (stock <= 0) {
    while (pendingLots.length) {
      const next = pendingLots.shift()!;
      if (next.qty <= 0) continue;
      stock = next.qty;
      cost = next.cost;
      break;
    }
  }
  return { ...current, stock, cost, pendingLots };
}
function moveSupplyStock(supplies: S[], sale: V, direction: -1 | 1) {
  if (isHistoricalSale(sale)) return supplies;
  const usage = packaging(sale, supplies).lines;
  return supplies.map((supply) => {
    const line = usage.find(
      (item) => supplyStockKey(item.name) === supplyStockKey(supply.name),
    );
    if (!line) return supply;
    const qty = Math.max(0, Number(line.qty) || 0);
    return direction === -1
      ? consumeSupplyStock(supply, qty)
      : { ...supply, stock: Math.max(0, supply.stock) + qty };
  });
}
""",
    "FIFO supply stock movement",
)

replace_once(
    '  ["clients", "Clientes", Users],\n  ["receivables", "Vendas a receber", ReceiptText],',
    '  ["clients", "Clientes", Users],\n  ["suppliers", "Fornecedores", Building2],\n  ["receivables", "Vendas a receber", ReceiptText],',
    "supplier nav item",
)
replace_once(
    '    [history, setHistory] = useState(0),\n    [toast, setToast] = useState("");',
    '    [history, setHistory] = useState(0),\n    [supplierHistory, setSupplierHistory] = useState(""),\n    [toast, setToast] = useState("");',
    "supplier history state",
)
replace_once(
    ': page === "clients"\n          ? ["Novo cliente", "client"]\n          : page === "receivables"',
    ': page === "clients"\n          ? ["Novo cliente", "client"]\n          : page === "suppliers"\n            ? ["Novo fornecedor", "supplier"]\n            : page === "receivables"',
    "supplier page action",
)
replace_once(
    """          ) : page === "clients" ? (
            <Clients
              d={data}
              set={setData}
              history={setHistory}
              edit={(id) => setModal({ type: "client", id })}
              notify={notify}
            />
          ) : (
            <Finance d={data} totals={totals} set={setData} notify={notify} />
          )}""",
    """          ) : page === "clients" ? (
            <Clients
              d={data}
              set={setData}
              history={setHistory}
              edit={(id) => setModal({ type: "client", id })}
              notify={notify}
            />
          ) : page === "suppliers" ? (
            <Suppliers
              d={data}
              set={setData}
              history={setSupplierHistory}
              edit={(id) => setModal({ type: "supplier", id })}
              notify={notify}
            />
          ) : (
            <Finance d={data} totals={totals} set={setData} notify={notify} />
          )}""",
    "supplier page render",
)
replace_once(
    """      {history ? (
        <History id={history} d={data} close={() => setHistory(0)} />
      ) : null}
      {toast ? (""",
    """      {history ? (
        <History id={history} d={data} close={() => setHistory(0)} />
      ) : null}
      {supplierHistory ? (
        <SupplierHistory
          name={supplierHistory}
          d={data}
          close={() => setSupplierHistory("")}
        />
      ) : null}
      {toast ? (""",
    "supplier history overlay",
)

replace_once(
    """  const brands = Array.from(
    new Set([
      ...(merged.brands || []),
      ...products.map((p: P) => p.brand).filter(Boolean),
    ]),
  ) as string[];
  const rawSales = (merged.sales || []) as V[];""",
    """  const brands = Array.from(
    new Set([
      ...(merged.brands || []),
      ...products.map((p: P) => p.brand).filter(Boolean),
    ]),
  ) as string[];
  const suppliers = Array.from(
    new Set([
      ...(merged.suppliers || []),
      ...(merged.purchases || []).map((purchase: B) => purchase.supplier).filter(Boolean),
    ]),
  ) as string[];
  const rawSales = (merged.sales || []) as V[];""",
    "supplier normalization",
)
replace_once(
    """  let normalizedSupplies = (merged.supplies || []).map((s: S) => ({
    ...s,
    attachCost: Boolean(s.attachCost),
  }));""",
    """  let normalizedSupplies = (merged.supplies || []).map((s: S) => ({
    ...s,
    attachCost: Boolean(s.attachCost),
    pendingLots: (s.pendingLots || []).map((lot) => ({
      ...lot,
      qty: Math.max(0, Number(lot.qty) || 0),
      cost: Math.max(0, Number(lot.cost) || 0),
    })),
  }));""",
    "pending lot normalization",
)
replace_once(
    """  if (!merged.supplyInventoryVersion) {
    normalizedSales.forEach((sale) => {
      normalizedSupplies = moveSupplyStock(normalizedSupplies, sale, -1);
    });
  }
  return {""",
    """  if (!merged.supplyInventoryVersion) {
    normalizedSales.forEach((sale) => {
      normalizedSupplies = moveSupplyStock(normalizedSupplies, sale, -1);
    });
  }
  normalizedSupplies = normalizedSupplies.map(activateNextSupplyLot);
  return {""",
    "activate queued lots on normalize",
)
replace_once(
    """    supplies: normalizedSupplies,
    brands,
    sales: normalizedSales,""",
    """    supplies: normalizedSupplies,
    suppliers,
    brands,
    sales: normalizedSales,""",
    "normalized suppliers return",
)

replace_once(
    """                <p>
                  {s.stock} {s.unit}
                  {s.cost ? ` · ${brl(s.cost)} por unidade` : ""}
                </p>
                <p>Custo na venda: {s.attachCost ? "Sim" : "Não"}</p>""",
    """                <p>
                  {s.stock} {s.unit}
                  {s.cost ? ` · ${brl(s.cost)} por unidade` : ""}
                </p>
                {(s.pendingLots || []).length ? (
                  <p className="queuedSupplyLot">
                    Em segundo plano: {(s.pendingLots || []).reduce((sum, lot) => sum + lot.qty, 0)} {s.unit}
                    {s.pendingLots?.[0] ? ` · próximo lote ${brl(s.pendingLots[0].cost)} por unidade` : ""}
                  </p>
                ) : null}
                <p>Custo na venda: {s.attachCost ? "Sim" : "Não"}</p>""",
    "queued supply stock display",
)
replace_once(
    """    set((x: D) => ({
      ...x,
      purchases: x.purchases.filter((p) => p.id !== id),
    }));""",
    """    set((x: D) => ({
      ...x,
      purchases: x.purchases.filter((p) => p.id !== id),
      supplies: x.supplies.map((supply) => ({
        ...supply,
        pendingLots: (supply.pendingLots || []).filter((lot) => lot.purchaseId !== id),
      })),
    }));""",
    "remove queued lot with purchase deletion",
)

supplier_components = """
function Suppliers({
  d,
  history,
  edit,
  set,
  notify,
}: {
  d: D;
  history: (name: string) => void;
  edit: (index: number) => void;
  set: any;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const suppliers = d.suppliers
    .map((name, index) => ({ name, index }))
    .filter(({ name }) =>
      name.toLowerCase().includes(query.trim().toLowerCase()),
    );
  function remove(index: number, name: string) {
    if (d.purchases.some((purchase) => purchase.supplier === name)) {
      window.alert(
        "Este fornecedor possui compras registradas e não pode ser excluído.",
      );
      return;
    }
    if (!window.confirm("Excluir este fornecedor?")) return;
    set((state: D) => ({
      ...state,
      suppliers: state.suppliers.filter((_, current) => current !== index),
    }));
    notify("Fornecedor excluído.");
  }
  return (
    <>
      <Cards v={[[String(d.suppliers.length), "Fornecedores cadastrados"]]} />
      <div className="clientSearch">
        <Search />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar fornecedor pelo nome"
          aria-label="Pesquisar fornecedor pelo nome"
        />
      </div>
      <div className="clients">
        {suppliers.map(({ name, index }) => {
          const purchases = d.purchases.filter(
            (purchase) => purchase.supplier === name,
          );
          const total = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
          return (
            <div key={`${name}-${index}`}>
              <i>
                {name
                  .split(" ")
                  .filter(Boolean)
                  .map((part) => part[0])
                  .slice(0, 2)}
              </i>
              <h3>{name}</h3>
              <p>
                {purchases.length} compra(s) · {brl(total)} em compras
              </p>
              <div className="clientActions">
                <button onClick={() => history(name)}>Ver histórico</button>
                <button onClick={() => edit(index)}>
                  <Pencil />
                  Editar
                </button>
                <button className="dangerText" onClick={() => remove(index, name)}>
                  <Trash2 />
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!suppliers.length ? (
        <p className="empty">Nenhum fornecedor encontrado.</p>
      ) : null}
    </>
  );
}

function SupplierHistory({
  name,
  d,
  close,
}: {
  name: string;
  d: D;
  close: () => void;
}) {
  const purchases = d.purchases.filter((purchase) => purchase.supplier === name);
  const total = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  return (
    <div className="overlay">
      <div className="history supplierHistory">
        <header>
          <div>
            <small>HISTÓRICO DE COMPRAS</small>
            <h2>{name}</h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <Cards
          v={[
            [String(purchases.length), "Compras registradas"],
            [brl(total), "Total comprado"],
          ]}
        />
        <div className="supplierHistoryTable">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{dateBR(purchase.date)}</td>
                  <td>{purchase.type}</td>
                  <td>{purchase.description}</td>
                  <td>
                    {purchase.qty}
                    {purchase.mlPerBottle ? ` × ${purchase.mlPerBottle} ml` : ""}
                  </td>
                  <td>{brl(purchase.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!purchases.length ? (
          <p className="empty">Nenhuma compra registrada com este fornecedor.</p>
        ) : null}
      </div>
    </div>
  );
}
"""
replace_once(
    "\nfunction PaymentBreakdown({ d }: { d: D }) {",
    supplier_components + "\nfunction PaymentBreakdown({ d }: { d: D }) {",
    "supplier components insertion",
)

replace_once(
    """function SaleCostEditor({ sale, d, close, save }: { sale: V; d: D; close: () => void; save: (sale: V) => void }) {
  const automatic = automaticPackaging(sale);""",
    """function SaleCostEditor({ sale, d, close, save }: { sale: V; d: D; close: () => void; save: (sale: V) => void }) {
  const supplyOptions = packagingOptions(sale, d.supplies);""",
    "cost editor dynamic options",
)
replace_once(
    "const [supplyQuantities, setSupplyQuantities] = useState<Record<string, number>>(Object.fromEntries(PACKAGING_RULES.map((name) => [name, sale.supplyOverrides?.[name] ?? automatic[name]])));",
    "const [supplyQuantities, setSupplyQuantities] = useState<Record<string, number>>(Object.fromEntries(supplyOptions.map(({ name, automaticQty }) => [name, sale.supplyOverrides?.[name] ?? automaticQty])));",
    "cost editor quantities",
)
replace_once(
    '<div className="costEditorSection"><h3>Insumos e suprimentos</h3>{PACKAGING_RULES.map((name) => <label key={name}>',
    '<div className="costEditorSection"><h3>Insumos e suprimentos</h3>{supplyOptions.map(({ name }) => <label key={name}>',
    "cost editor supply list",
)

replace_once(
    """        supplies: x.supplies.map((s) =>
          s.id === supply.id
            ? {
                ...s,
                name: String(f.name),
                unit: String(f.unit),
                stock,
                cost,
                attachCost: f.attachCost === "Sim",
              }
            : s,
        ),""",
    """        supplies: x.supplies.map((s) =>
          s.id === supply.id
            ? activateNextSupplyLot({
                ...s,
                name: String(f.name),
                unit: String(f.unit),
                stock,
                cost,
                attachCost: f.attachCost === "Sim",
              })
            : s,
        ),""",
    "activate queued lot after manual stock edit",
)
replace_once(
    """      const item = d.supplies.find(
        (s) =>
          s.name.trim().toLowerCase() ===
          purchase.description.trim().toLowerCase(),
      );
      const target = purchase.type === "Perfume" ? product : item;""",
    """      const item = d.supplies.find(
        (s) =>
          s.name.trim().toLowerCase() ===
          purchase.description.trim().toLowerCase(),
      );
      const queuedLot = item?.pendingLots?.find(
        (lot) => lot.purchaseId === purchase.id,
      );
      if (item && purchase.type !== "Perfume" && queuedLot) {
        const newCost = total / (qty || 1);
        set((x: D) => ({
          ...x,
          purchases: x.purchases.map((p) =>
            p.id === purchase.id
              ? {
                  ...p,
                  date: String(f.date),
                  supplier: String(f.supplier),
                  qty,
                  total,
                }
              : p,
          ),
          supplies: x.supplies.map((supplyItem) =>
            supplyItem.id === item.id
              ? {
                  ...supplyItem,
                  pendingLots: (supplyItem.pendingLots || []).map((lot) =>
                    lot.purchaseId === purchase.id
                      ? { ...lot, qty, cost: newCost }
                      : lot,
                  ),
                }
              : supplyItem,
          ),
        }));
        close();
        return;
      }
      const target = purchase.type === "Perfume" ? product : item;""",
    "edit queued supply purchase",
)

replace_once(
    """  const type = modal!.type,
    existingSale = d.sales.find((s) => s.id === modal!.id),
    existingClient = d.clients.find((c) => c.id === modal!.id),
    existingProduct = d.products.find((p) => p.id === modal!.id);""",
    """  const type = modal!.type,
    existingSale = d.sales.find((s) => s.id === modal!.id),
    existingClient = d.clients.find((c) => c.id === modal!.id),
    existingProduct = d.products.find((p) => p.id === modal!.id),
    existingSupplier =
      type === "supplier" && modal!.id !== undefined
        ? d.suppliers[modal!.id]
        : undefined;""",
    "existing supplier form state",
)
replace_once(
    """    set((x: D) => {
      if (type === "product") {""",
    """    if (type === "supplier") {
      const supplierName = String(f.name || "").trim();
      if (!supplierName) {
        window.alert("Informe o nome do fornecedor.");
        return;
      }
      const duplicated = d.suppliers.some(
        (name, index) =>
          index !== modal!.id &&
          name.trim().toLowerCase() === supplierName.toLowerCase(),
      );
      if (duplicated) {
        window.alert("Este fornecedor já está cadastrado.");
        return;
      }
    }
    set((x: D) => {
      if (type === "product") {""",
    "supplier form validation",
)
replace_once(
    """      if (type === "client") {
        const c = mkC(f, addressCount, existingClient?.id);
        return {
          ...x,
          clients: existingClient
            ? x.clients.map((v) => (v.id === c.id ? c : v))
            : [...x.clients, c],
        };
      }
      if (isOldSale) {""",
    """      if (type === "client") {
        const c = mkC(f, addressCount, existingClient?.id);
        return {
          ...x,
          clients: existingClient
            ? x.clients.map((v) => (v.id === c.id ? c : v))
            : [...x.clients, c],
        };
      }
      if (type === "supplier") {
        const supplierName = String(f.name).trim();
        if (existingSupplier !== undefined && modal!.id !== undefined) {
          return {
            ...x,
            suppliers: x.suppliers.map((name, index) =>
              index === modal!.id ? supplierName : name,
            ),
            purchases: x.purchases.map((purchase) =>
              purchase.supplier === existingSupplier
                ? { ...purchase, supplier: supplierName }
                : purchase,
            ),
          };
        }
        return { ...x, suppliers: [...x.suppliers, supplierName] };
      }
      if (isOldSale) {""",
    "supplier save case",
)
replace_once(
    """        const supplier = newSupplier
            ? String(f.newSupplier)
            : String(f.supplier),""",
    """        const supplier = (newSupplier
            ? String(f.newSupplier)
            : String(f.supplier)).trim(),""",
    "trim purchase supplier",
)
replace_once(
    """        } else if (kind === "Suprimento / insumo") {
          const found = x.supplies.find(
            (s) => s.name.toLowerCase() === description.toLowerCase(),
          );
          supplies = found
            ? x.supplies.map((s) =>
                s.id === found.id
                  ? {
                      ...s,
                      stock: s.stock + qty,
                      attachCost: String(f.attachCost) === "Sim",
                      cost:
                        ((s.cost || 0) * s.stock + total) /
                        (s.stock + qty || 1),
                    }
                  : s,
              )
            : [
                ...x.supplies,
                {
                  id: Date.now() + 1,
                  name: description,
                  stock: qty,
                  unit: String(f.unit),
                  min: 0,
                  attachCost: String(f.attachCost) === "Sim",
                  cost: total / (qty || 1),
                },
              ];
        }""",
    """        } else if (kind === "Suprimento / insumo") {
          const found = x.supplies.find(
            (s) => s.name.toLowerCase() === description.toLowerCase(),
          );
          const unitCost = total / (qty || 1);
          supplies = found
            ? x.supplies.map((s) => {
                if (s.id !== found.id) return s;
                const current = activateNextSupplyLot(s);
                const attachCost = String(f.attachCost) === "Sim";
                if (current.stock > 0) {
                  return {
                    ...current,
                    attachCost,
                    pendingLots: [
                      ...(current.pendingLots || []),
                      {
                        purchaseId: purchase.id,
                        qty,
                        cost: unitCost,
                        unit: String(f.unit || current.unit),
                      },
                    ],
                  };
                }
                return {
                  ...current,
                  stock: qty,
                  unit: String(f.unit || current.unit),
                  attachCost,
                  cost: unitCost,
                };
              })
            : [
                ...x.supplies,
                {
                  id: Date.now() + 1,
                  name: description,
                  stock: qty,
                  unit: String(f.unit),
                  min: 0,
                  attachCost: String(f.attachCost) === "Sim",
                  cost: unitCost,
                  pendingLots: [],
                },
              ];
        }""",
    "FIFO supply purchase handling",
)
replace_once(
    """          suppliers: x.suppliers.includes(supplier)
            ? x.suppliers
            : [...x.suppliers, supplier],""",
    """          suppliers: x.suppliers.some(
            (name) => name.toLowerCase() === supplier.toLowerCase(),
          )
            ? x.suppliers
            : [...x.suppliers, supplier],""",
    "case insensitive supplier dedupe",
)
replace_once(
    '''    : type === "client"
      ? existingClient
        ? "Editar cliente"
        : "Cadastrar cliente"
      : type === "product"''',
    '''    : type === "client"
      ? existingClient
        ? "Editar cliente"
        : "Cadastrar cliente"
      : type === "supplier"
        ? existingSupplier !== undefined
          ? "Editar fornecedor"
          : "Cadastrar fornecedor"
      : type === "product"''',
    "supplier form title",
)
replace_once(
    '<Field n="description" l="Especifique o suprimento / insumo" />',
    """<label>
                  <span>Suprimento / insumo</span>
                  <input
                    name="description"
                    list="purchase-supply-options"
                    placeholder="Selecione um existente ou digite um novo"
                    required
                  />
                  <datalist id="purchase-supply-options">
                    {d.supplies.map((supply) => (
                      <option key={supply.id} value={supply.name} />
                    ))}
                  </datalist>
                </label>""",
    "supply purchase selector",
)
replace_once(
    """        ) : null}
        <footer>
          <button type="button" onClick={close}>""",
    """        ) : null}
        {type === "supplier" ? (
          <Field
            n="name"
            l="Nome do fornecedor"
            v={existingSupplier || ""}
          />
        ) : null}
        <footer>
          <button type="button" onClick={close}>""",
    "supplier form fields",
)

replace_once(
    """}) {
  const automatic = automaticPackaging({ items });
  const effectiveSale = { items, supplyOverrides: overrides };""",
    """}) {
  const options = packagingOptions({ items }, supplies);
  const automatic = Object.fromEntries(
    options.map(({ name, automaticQty }) => [name, automaticQty]),
  ) as Record<string, number>;
  const effectiveSale = { items, supplyOverrides: overrides };""",
    "sale supply picker options",
)
replace_once(
    """        {PACKAGING_RULES.map((name) => {
          const qty = overrides[name] ?? automatic[name];""",
    """        {options.map(({ name, automaticQty }) => {
          const qty = overrides[name] ?? automaticQty;""",
    "dynamic sale supply list",
)
replace_once(
    "event.target.checked ? automatic[name] || 1 : 0,",
    "event.target.checked ? automaticQty || 1 : 0,",
    "dynamic supply toggle quantity",
)

app_path.write_text(app, encoding="utf-8")

packaging_path.write_text(
    r'''const key = (value: string) =>
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
''',
    encoding="utf-8",
)

css_add = r'''

/* Supplier history and queued supply lots */
.queuedSupplyLot {
  color: var(--gold);
  font-size: 11px;
  font-weight: 700;
}
.supplierHistory {
  width: min(920px, calc(100vw - 32px));
}
.supplierHistoryTable {
  overflow-x: auto;
  margin-top: 18px;
}
.supplierHistoryTable table {
  width: 100%;
  border-collapse: collapse;
}
.supplierHistoryTable th,
.supplierHistoryTable td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}
'''
if "/* Supplier history and queued supply lots */" not in css:
    css = css.rstrip() + css_add + "\n"
css_path.write_text(css, encoding="utf-8")
