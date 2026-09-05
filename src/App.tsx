"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardCheck,
  Box,
  ShoppingCart,
  Users,
  Wallet,
  Plus,
  X,
  Check,
  Truck,
  Pencil,
  LogOut,
  Cloud,
  CloudOff,
  Trash2,
  Ban,
  Search,
  ReceiptText,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";

type P = {
  id: number;
  brand: string;
  name: string;
  category: string;
  gender?: string;
  stock: number;
  min: number;
  cost: number;
  apc: number;
};
type S = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  min: number;
  attachCost: boolean;
  cost?: number;
};
type C = {
  id: number;
  name: string;
  phone: string;
  cpf: string;
  cep: string;
  date: string;
  addresses: { label: string; value: string }[];
};
type L = { productId: number; ml: number; isApc?: boolean; unitCost?: number };
type Installment = { date: string; amount: number; paid?: boolean };
type V = {
  id: number;
  date: string;
  clientId: number;
  items: L[];
  total: number;
  paid: number;
  payment: string;
  paymentNote?: string;
  dueDate?: string;
  installment?: number;
  installments?: Installment[];
  prepared: boolean;
  sent?: boolean;
  status?: string;
  expenses?: number;
};
type B = {
  id: number;
  date: string;
  supplier: string;
  type: string;
  description: string;
  qty: number;
  total: number;
  mlPerBottle?: number;
  attachCost?: boolean;
};
type D = {
  products: P[];
  supplies: S[];
  clients: C[];
  sales: V[];
  purchases: B[];
  suppliers: string[];
  brands: string[];
};
type Modal = { type: string; id?: number } | null;

const blank: D = {
  products: [],
  supplies: [],
  clients: [],
  sales: [],
  purchases: [],
  suppliers: [],
  brands: [],
};
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const LOGO =
  "data:image/webp;base64,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";
const nav = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["sales", "Vendas", ShoppingBag],
  ["prepare", "Pedidos para preparar", ClipboardCheck],
  ["shipping", "Envios", Truck],
  ["stock", "Estoque", Box],
  ["purchases", "Compras", ShoppingCart],
  ["clients", "Clientes", Users],
  ["receivables", "Vendas a receber", ReceiptText],
  ["finance", "Financeiro", Wallet],
] as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);
  if (!isSupabaseConfigured) return <SetupRequired />;
  if (authLoading)
    return (
      <div className="authPage">
        <div className="authCard">
          <Cloud />
          <h1>Conectando ao Supabase...</h1>
        </div>
      </div>
    );
  if (!session) return <Auth />;
  return <System session={session} />;
}

function System({ session }: { session: Session }) {
  const [data, setData] = useState<D>(() => readLocal()),
    [ready, setReady] = useState(false),
    [sync, setSync] = useState<"loading" | "saved" | "error">("loading");
  const saveTimer = useRef<number | undefined>(undefined);
  const [page, setPage] = useState("dashboard"),
    [modal, setModal] = useState<Modal>(null),
    [history, setHistory] = useState(0),
    [toast, setToast] = useState("");
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: remote, error } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setSync("error");
        return;
      }
      if (remote?.data && Object.keys(remote.data).length) {
        setData(normalizeData(remote.data));
      } else {
        const local = readLocal();
        const { error: saveError } = await supabase
          .from("app_state")
          .upsert({ user_id: session.user.id, data: local });
        if (saveError) {
          setSync("error");
          return;
        }
      }
      setReady(true);
      setSync("saved");
    })();
    return () => {
      active = false;
    };
  }, [session.user.id]);
  useEffect(() => {
    localStorage.setItem("daf-v4", JSON.stringify(data));
    if (!ready) return;
    setSync("loading");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from("app_state")
        .upsert({ user_id: session.user.id, data });
      setSync(error ? "error" : "saved");
    }, 450);
    return () => window.clearTimeout(saveTimer.current);
  }, [data, ready, session.user.id]);
  const totals = useMemo(
    () =>
      data.sales
        .filter((s) => s.status !== "cancelled" && !isNoCost(s))
        .reduce(
          (a, s) => ({ gross: a.gross + s.total, paid: a.paid + s.paid }),
          { gross: 0, paid: 0 },
        ),
    [data.sales],
  );
  const action =
    page === "sales"
      ? ["Nova venda", "sale"]
      : page === "stock"
        ? ["Novo perfume", "product"]
        : page === "purchases"
          ? ["Nova compra", "purchase"]
          : page === "clients"
            ? ["Novo cliente", "client"]
            : page === "receivables"
              ? ["Cadastrar venda antiga", "sale"]
              : null;
  if (!ready && sync !== "error")
    return (
      <div className="authPage">
        <div className="authCard">
          <Cloud />
          <h1>Carregando seus dados...</h1>
        </div>
      </div>
    );
  return (
    <div className="shell">
      <aside>
        <img src={LOGO} alt="DAF Splits" />
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "on" : ""}
              onClick={() => setPage(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className={"sync " + sync}>
          {sync === "error" ? <CloudOff /> : <Cloud />}
          {sync === "saved"
            ? "Dados sincronizados"
            : sync === "error"
              ? "Falha na sincronização"
              : "Salvando..."}
        </div>
        <footer>
          FC{" "}
          <span>
            Fábio Cruz<small>{session.user.email}</small>
          </span>
          <button title="Sair" onClick={() => supabase.auth.signOut()}>
            <LogOut />
          </button>
        </footer>
      </aside>
      <main>
        <header>
          <div>
            <small>PAINEL ADMINISTRATIVO</small>
            <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
          </div>
          {action ? (
            <button
              className="primary"
              onClick={() => setModal({ type: action[1] })}
            >
              <Plus />
              {action[0]}
            </button>
          ) : null}
        </header>
        <section className="content">
          {page === "dashboard" ? (
            <Dash d={data} totals={totals} />
          ) : page === "sales" ? (
            <Sales
              d={data}
              edit={(id) => setModal({ type: "sale", id })}
              set={setData}
              notify={notify}
            />
          ) : page === "prepare" ? (
            <Prepare d={data} set={setData} notify={notify} />
          ) : page === "shipping" ? (
            <Shipping d={data} set={setData} notify={notify} />
          ) : page === "receivables" ? (
            <Receivables
              d={data}
              set={setData}
              edit={(id) => setModal({ type: "sale", id })}
              notify={notify}
            />
          ) : page === "stock" ? (
            <Stock
              d={data}
              set={setData}
              add={() => setModal({ type: "supply" })}
              edit={(id) => setModal({ type: "product", id })}
              notify={notify}
            />
          ) : page === "purchases" ? (
            <Purchases d={data} set={setData} notify={notify} />
          ) : page === "clients" ? (
            <Clients
              d={data}
              set={setData}
              history={setHistory}
              edit={(id) => setModal({ type: "client", id })}
              notify={notify}
            />
          ) : (
            <Finance d={data} totals={totals} set={setData} notify={notify} />
          )}
        </section>
      </main>
      {modal ? (
        <Form
          modal={modal}
          d={data}
          set={setData}
          close={() => setModal(null)}
        />
      ) : null}
      {history ? (
        <History id={history} d={data} close={() => setHistory(0)} />
      ) : null}
      {toast ? (
        <div className="toast">
          <Check />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function normalizeData(stored: any): D {
  const merged = { ...blank, ...stored };
  const products = (merged.products || []).map((p: P) => ({
    ...p,
    category: p.category === "Importado" ? "Designer" : p.category,
    gender: p.gender || "Unissex",
    apc: p.apc ?? 1,
  }));
  const brands = Array.from(
    new Set([
      ...(merged.brands || []),
      ...products.map((p: P) => p.brand).filter(Boolean),
    ]),
  ) as string[];
  return {
    ...merged,
    products,
    supplies: (merged.supplies || []).map((s: S) => ({
      ...s,
      attachCost: Boolean(s.attachCost),
    })),
    brands,
    sales: (merged.sales || []).map((s: V) => ({
      ...s,
      sent: Boolean(s.sent),
      status: s.status || "active",
      expenses: Number(s.expenses || 0),
      items: (s.items || []).map((item: L) => ({
        ...item,
        isApc: Boolean(item.isApc),
        unitCost:
          item.unitCost ??
          products.find((p: P) => p.id === item.productId)?.cost ??
          0,
      })),
      installments: s.installments?.length
        ? s.installments
        : s.dueDate
          ? [
              {
                date: s.dueDate,
                amount: s.installment || Math.max(0, s.total - s.paid),
              },
            ]
          : [],
    })),
  };
}
function readLocal(): D {
  try {
    const stored = JSON.parse(localStorage.getItem("daf-v4") || "null");
    return stored ? normalizeData(stored) : blank;
  } catch {
    return blank;
  }
}
function SetupRequired() {
  return (
    <div className="authPage">
      <div className="authCard">
        <CloudOff />
        <h1>Supabase não configurado</h1>
        <p>
          Adicione as variáveis VITE_SUPABASE_URL e
          VITE_SUPABASE_PUBLISHABLE_KEY na Vercel.
        </p>
      </div>
    </div>
  );
}
function Auth() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      email = String(f.email),
      password = String(f.password);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    setMessage(error ? "E-mail ou senha incorretos." : "");
  }
  return (
    <div className="authPage">
      <form className="authCard" onSubmit={submit}>
        <img src={LOGO} alt="DAF Splits" />
        <small>SISTEMA DE GESTÃO</small>
        <h1>Entrar no sistema</h1>
        <label>
          <span>E-mail</span>
          <input name="email" type="email" required />
        </label>
        <label>
          <span>Senha</span>
          <input name="password" type="password" minLength={6} required />
        </label>
        {message ? <p className="authMessage">{message}</p> : null}
        <button className="primary" disabled={busy}>
          {busy ? "Aguarde..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function Cards({ v }: { v: [string, string][] }) {
  return (
    <div className="cards">
      {v.map(([value, label]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function Dash({
  d,
  totals,
}: {
  d: D;
  totals: { gross: number; paid: number };
}) {
  const activeSales = d.sales.filter(
    (s) => s.status !== "cancelled" && !isNoCost(s),
  );
  const now = new Date(),
    days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    day = now.getDate();
  const daily = Array.from({ length: days }, (_, i) =>
    activeSales
      .filter((s) => new Date(s.date + "T12:00").getDate() === i + 1)
      .reduce((n, s) => n + s.total, 0),
  );
  const avg = daily.slice(0, day).reduce((n, v) => n + v, 0) / Math.max(1, day),
    max = Math.max(avg, ...daily, 1);
  const categories = ["Nicho", "Árabe", "Designer"].map((category) => ({
    category,
    value: activeSales.reduce((sum, s) => {
      const totalMl = s.items.reduce((n, x) => n + x.ml, 0) || 1;
      const categoryMl = s.items
        .filter(
          (x) =>
            d.products.find((p) => p.id === x.productId)?.category === category,
        )
        .reduce((n, x) => n + x.ml, 0);
      return sum + (s.total * categoryMl) / totalMl;
    }, 0),
  }));
  const catTotal = categories.reduce((n, x) => n + x.value, 0),
    catMax = Math.max(1, ...categories.map((x) => x.value));
  const paid = activeSales.filter((s) => s.paid >= s.total).length,
    partial = activeSales.filter((s) => s.paid > 0 && s.paid < s.total).length,
    pending = activeSales.filter((s) => !s.paid).length,
    count = paid + partial + pending;
  const a = count ? (paid / count) * 360 : 0,
    b = count ? ((paid + partial) / count) * 360 : 0;
  return (
    <>
      <Cards
        v={[
          [brl(totals.gross), "Faturamento mensal"],
          [brl(totals.paid), "Total recebido"],
          [brl(totals.gross - totals.paid), "A receber"],
          [brl(totals.gross / (activeSales.length || 1)), "Ticket médio"],
        ]}
      />
      <div className="grid">
        <div className="dashboardMain">
          <div className="panel chart">
            <h2>Faturamento consolidado + tendência</h2>
            <p>Passe o mouse ou toque em uma barra para ver o valor</p>
            <div className="stats">
              Média diária <b>{brl(avg)}</b> · Projeção mensal{" "}
              <b>{brl(avg * days)}</b>
            </div>
            <div className="bars">
              {daily.map((value, i) => {
                const n = i >= day ? avg : value;
                return (
                  <button key={i} aria-label={`Dia ${i + 1}: ${brl(n)}`}>
                    <span>{brl(n)}</span>
                    <i
                      className={i >= day ? "future" : ""}
                      style={{ height: Math.max(4, (n / max) * 100) + "%" }}
                    />
                    <small>{i + 1}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <PaymentBreakdown d={d} />
        </div>
        <div className="sidecharts">
          <div className="panel">
            <h2>Resumo dos pedidos</h2>
            <div
              className="donut statusDonut"
              style={{
                background: count
                  ? `conic-gradient(#22a66f 0 ${a}deg,#e0b43c ${a}deg ${b}deg,#e5484d ${b}deg 360deg)`
                  : undefined,
              }}
            >
              <span>
                <b>{Math.round((totals.paid / (totals.gross || 1)) * 100)}%</b>
                <small>recebido</small>
              </span>
            </div>
            <p className="green">
              Pagos <b>{paid}</b>
            </p>
            <p className="yellow">
              Parciais <b>{partial}</b>
            </p>
            <p className="red">
              Pendentes <b>{pending}</b>
            </p>
          </div>
          <div className="panel categories">
            <h2>Vendas por categoria</h2>
            <div
              className="categoryDonut"
              style={{ background: categoryGradient(categories, catTotal) }}
            />
            <div className="categoryLegend">
              {categories.map((x) => (
                <div
                  key={x.category}
                  className={x.category
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")}
                >
                  <span>
                    {x.category}
                    <b>{brl(x.value)}</b>
                  </span>
                  <i>
                    <b style={{ width: (x.value / catMax) * 100 + "%" }} />
                  </i>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function categoryGradient(
  c: { category: string; value: number }[],
  total: number,
) {
  if (!total) return "#303b4c";
  let n = 0;
  const color: { [k: string]: string } = {
    Nicho: "#e0b43c",
    Árabe: "#8b5cf6",
    Designer: "#2f80ed",
  };
  return `conic-gradient(${c
    .map((x) => {
      const start = (n / total) * 360;
      n += x.value;
      return `${color[x.category]} ${start}deg ${(n / total) * 360}deg`;
    })
    .join(",")})`;
}

function Sales({
  d,
  edit,
  set,
  notify,
}: {
  d: D;
  edit?: (id: number) => void;
  set?: any;
  notify?: (s: string) => void;
}) {
  function restoreStock(x: D, s: V) {
    return x.products.map((p) => ({
      ...p,
      stock:
        p.stock +
        s.items
          .filter((i) => i.productId === p.id)
          .reduce((n, i) => n + i.ml, 0),
      apc: Math.min(
        1,
        p.apc + (s.items.some((i) => i.productId === p.id && i.isApc) ? 1 : 0),
      ),
    }));
  }
  function cancel(s: V) {
    if (
      !set ||
      !window.confirm(`Cancelar o pedido #${s.id}? O estoque será devolvido.`)
    )
      return;
    set((x: D) => ({
      ...x,
      products: restoreStock(x, s),
      sales: x.sales.map((v) =>
        v.id === s.id ? { ...v, status: "cancelled" } : v,
      ),
    }));
    notify?.("Venda cancelada e estoque devolvido.");
  }
  function remove(s: V) {
    if (!set || !window.confirm(`Excluir definitivamente o pedido #${s.id}?`))
      return;
    set((x: D) => ({
      ...x,
      products: s.status === "cancelled" ? x.products : restoreStock(x, s),
      sales: x.sales.filter((v) => v.id !== s.id),
    }));
    notify?.("Venda excluída.");
  }
  return (
    <div className="panel table">
      <h2>Vendas</h2>
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Produtos</th>
            <th>Pagamento</th>
            <th>Total</th>
            <th>Status</th>
            {edit ? <th>Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {d.sales.map((s) => (
            <tr
              key={s.id}
              className={s.status === "cancelled" ? "cancelled" : ""}
            >
              <td>
                #{s.id}
                <small>{s.date}</small>
                {s.status === "cancelled" ? <em>Cancelada</em> : null}
              </td>
              <td>{d.clients.find((c) => c.id === s.clientId)?.name}</td>
              <td>
                {s.items.map((x, i) => (
                  <small key={i}>
                    {d.products.find((p) => p.id === x.productId)?.name} —{" "}
                    {x.ml} ml{x.isApc ? " · APC" : ""}
                  </small>
                ))}
              </td>
              <td>
                {s.payment}
                {s.dueDate ? (
                  <small>
                    {s.dueDate} · {brl(s.installment || 0)}
                  </small>
                ) : null}
              </td>
              <td>{brl(s.total)}</td>
              <td>{saleBadge(s)}</td>
              {edit ? (
                <td>
                  <div className="tableActions">
                    {s.status !== "cancelled" ? (
                      <>
                        <button
                          className="iconButton"
                          onClick={() => edit(s.id)}
                        >
                          <Pencil />
                          Editar
                        </button>
                        <button
                          className="iconButton danger"
                          onClick={() => cancel(s)}
                        >
                          <Ban />
                          Cancelar
                        </button>
                      </>
                    ) : null}
                    <button
                      className="iconButton danger"
                      onClick={() => remove(s)}
                    >
                      <Trash2 />
                      Excluir
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const standardPayments = ["Pix", "Cartão de Crédito", "Dinheiro", "À prazo"];
function isNoCost(s: V) {
  return s.payment === "Outro" || !standardPayments.includes(s.payment);
}
function saleBadge(s: V) {
  const label =
    s.status === "cancelled"
      ? "Cancelada"
      : isNoCost(s)
        ? "Sem custo"
        : s.paid >= s.total
          ? "Pago"
          : "A prazo";
  return (
    <span
      className={`saleBadge ${label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f ]/g, "")}`}
    >
      {label}
    </span>
  );
}

function Prepare({
  d,
  set,
  notify,
}: {
  d: D;
  set: any;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("pending");
  const list = d.sales.filter(
    (s) =>
      s.status !== "cancelled" && (tab === "done" ? s.prepared : !s.prepared),
  );
  function toggle(s: V) {
    const done = !s.prepared;
    set((x: D) => ({
      ...x,
      sales: x.sales.map((v) =>
        v.id === s.id
          ? { ...v, prepared: done, sent: done ? v.sent : false }
          : v,
      ),
    }));
    notify(
      done
        ? `Pedido #${s.id} movido para Finalizados.`
        : `Pedido #${s.id} voltou para A preparar.`,
    );
  }
  return (
    <div className="panel">
      <h2>Pedidos para preparar</h2>
      <p>Lista alimentada exclusivamente pelas vendas.</p>
      <div className="segmented">
        <button
          className={tab === "pending" ? "active" : ""}
          onClick={() => setTab("pending")}
        >
          A preparar
        </button>
        <button
          className={tab === "done" ? "active" : ""}
          onClick={() => setTab("done")}
        >
          Finalizados
        </button>
      </div>
      <div className="prepare">
        {list.map((s) => (
          <div key={s.id} className={s.prepared ? "done" : ""}>
            <button
              className="checkButton"
              aria-label={s.prepared ? "Reabrir pedido" : "Finalizar pedido"}
              onClick={() => toggle(s)}
            >
              {s.prepared ? <Check /> : null}
            </button>
            <span>
              <b>{d.clients.find((c) => c.id === s.clientId)?.name}</b>
              {s.items.map((x, i) => (
                <small key={i}>
                  {d.products.find((p) => p.id === x.productId)?.name} — {x.ml}{" "}
                  ml{x.isApc ? " · APC" : ""}
                </small>
              ))}
            </span>
            <em>{s.prepared ? "Finalizado" : "A preparar"}</em>
          </div>
        ))}
        {!list.length ? <p>Nenhum pedido nesta lista.</p> : null}
      </div>
    </div>
  );
}

function Shipping({
  d,
  set,
  notify,
}: {
  d: D;
  set: any;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("pending");
  const list = d.sales.filter(
    (s) =>
      s.status !== "cancelled" &&
      s.prepared &&
      (tab === "sent" ? s.sent : !s.sent),
  );
  function toggle(s: V) {
    const sent = !s.sent;
    set((x: D) => ({
      ...x,
      sales: x.sales.map((v) => (v.id === s.id ? { ...v, sent } : v)),
    }));
    notify(
      sent
        ? `Pedido #${s.id} movido para Enviados.`
        : `Pedido #${s.id} voltou para A enviar.`,
    );
  }
  return (
    <div className="panel">
      <h2>Envios</h2>
      <p>Apenas pedidos já preparados aparecem aqui.</p>
      <div className="segmented">
        <button
          className={tab === "pending" ? "active" : ""}
          onClick={() => setTab("pending")}
        >
          A enviar
        </button>
        <button
          className={tab === "sent" ? "active" : ""}
          onClick={() => setTab("sent")}
        >
          Enviados
        </button>
      </div>
      <div className="shipping">
        {list.map((s) => {
          const c = d.clients.find((x) => x.id === s.clientId);
          return (
            <div className={`shippingItem ${s.sent ? "done" : ""}`} key={s.id}>
              <button
                className="checkButton"
                aria-label={
                  s.sent ? "Marcar como não enviado" : "Marcar como enviado"
                }
                onClick={() => toggle(s)}
              >
                {s.sent ? <Check /> : null}
              </button>
              <details>
                <summary>
                  <span>
                    <b>
                      Pedido #{s.id} · {c?.name}
                    </b>
                    <small>
                      {s.items
                        .map(
                          (x) =>
                            `${d.products.find((p) => p.id === x.productId)?.name} — ${x.ml} ml`,
                        )
                        .join(" · ")}
                    </small>
                  </span>
                  <strong>Informações de entrega</strong>
                </summary>
                <div className="delivery">
                  <FieldView label="Nome" value={c?.name} />
                  <FieldView label="CPF" value={c?.cpf} />
                  <FieldView label="Telefone" value={c?.phone} />
                  <label>
                    <span>Endereço</span>
                    <select defaultValue={c?.addresses[0]?.value}>
                      {c?.addresses.map((a, i) => (
                        <option key={i} value={a.value}>
                          {a.label ? `${a.label} — ` : ""}
                          {a.value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FieldView label="CEP" value={c?.cep} />
                </div>
              </details>
            </div>
          );
        })}
        {!list.length ? <p>Nenhum pedido nesta lista.</p> : null}
      </div>
    </div>
  );
}
function FieldView({ label, value }: { label: string; value?: string }) {
  return (
    <label>
      <span>{label}</span>
      <input readOnly value={value || "Não informado"} />
    </label>
  );
}

function Receivables({
  d,
  set,
  edit,
  notify,
}: {
  d: D;
  set: any;
  edit: (id: number) => void;
  notify: (message: string) => void;
}) {
  const list = d.sales
    .filter((s) => s.status !== "cancelled" && !isNoCost(s) && s.paid < s.total)
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = list.reduce((n, s) => n + Math.max(0, s.total - s.paid), 0);
  function recordPayment(s: V) {
    const raw = window.prompt(
      `Quanto o cliente pagou agora?\nSaldo atual: ${brl(s.total - s.paid)}`,
    );
    if (raw === null) return;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Informe um valor de pagamento válido.");
      return;
    }
    set((x: D) => ({
      ...x,
      sales: x.sales.map((sale) => {
        if (sale.id !== s.id) return sale;
        const paid = Math.min(sale.total, sale.paid + amount);
        const scheduleTotal = (sale.installments || []).reduce(
          (n, installment) => n + installment.amount,
          0,
        );
        const paidTowardSchedule = Math.max(
          0,
          paid - Math.max(0, sale.total - scheduleTotal),
        );
        let accumulated = 0;
        const installments = (sale.installments || []).map((installment) => {
          accumulated += installment.amount;
          return {
            ...installment,
            paid: accumulated <= paidTowardSchedule + 0.01,
          };
        });
        return { ...sale, paid, installments };
      }),
    }));
    notify(
      amount >= s.total - s.paid
        ? `Pedido #${s.id} quitado.`
        : `Pagamento de ${brl(amount)} lançado no pedido #${s.id}.`,
    );
  }
  return (
    <>
      <Cards
        v={[
          [brl(total), "Total a receber"],
          [String(list.length), "Vendas pendentes"],
        ]}
      />
      <div className="panel table">
        <h2>Vendas a receber</h2>
        <p>Inclui vendas pendentes de qualquer mês.</p>
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Data da venda</th>
              <th>Falta pagar</th>
              <th>Próximos pagamentos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td>{d.clients.find((c) => c.id === s.clientId)?.name}</td>
                <td>{s.date}</td>
                <td>
                  <b>{brl(Math.max(0, s.total - s.paid))}</b>
                </td>
                <td>
                  {s.installments?.length ? (
                    s.installments
                      .filter((p) => !p.paid)
                      .map((p, i) => (
                        <small key={i}>
                          {p.date || "Sem data"} — {brl(p.amount)}
                        </small>
                      ))
                  ) : (
                    <small>Não informado</small>
                  )}
                </td>
                <td>
                  <div className="tableActions">
                    <button
                      className="iconButton payButton"
                      onClick={() => recordPayment(s)}
                    >
                      <Wallet /> Dar baixa
                    </button>
                    <button className="iconButton" onClick={() => edit(s.id)}>
                      <Pencil /> Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length ? <p className="empty">Nenhuma venda pendente.</p> : null}
      </div>
    </>
  );
}

function Stock({
  d,
  add,
  edit,
  set,
  notify,
}: {
  d: D;
  add: () => void;
  edit: (id: number) => void;
  set: any;
  notify: (s: string) => void;
}) {
  const [view, setView] = useState("perfumes"),
    [category, setCategory] = useState("Todos"),
    [brand, setBrand] = useState("Todas"),
    [query, setQuery] = useState("");
  const brands = Array.from(new Set(d.products.map((p) => p.brand))).sort();
  const filtered = d.products.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      (brand === "Todas" || p.brand === brand) &&
      `${p.brand} ${p.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  function removeProduct(id: number) {
    if (!window.confirm("Excluir este perfume do estoque?")) return;
    set((x: D) => ({ ...x, products: x.products.filter((p) => p.id !== id) }));
    notify("Perfume excluído do estoque.");
  }
  function removeSupply(id: number) {
    if (!window.confirm("Excluir este suprimento do estoque?")) return;
    set((x: D) => ({ ...x, supplies: x.supplies.filter((s) => s.id !== id) }));
    notify("Suprimento excluído do estoque.");
  }
  return (
    <>
      <div className="stockHead">
        <div>
          <h2>Estoque</h2>
          <p>Escolha qual tipo de estoque deseja consultar.</p>
        </div>
        <button className="secondary" onClick={add}>
          <Plus />
          Cadastrar suprimento/insumo
        </button>
      </div>
      <div className="segmented stockSwitch">
        <button
          className={view === "perfumes" ? "active" : ""}
          onClick={() => setView("perfumes")}
        >
          Perfumes
        </button>
        <button
          className={view === "supplies" ? "active" : ""}
          onClick={() => setView("supplies")}
        >
          Suprimentos / insumos
        </button>
      </div>
      {view === "perfumes" ? (
        <>
          <Cards
            v={[
              [String(d.products.length), "Perfumes"],
              [
                d.products.reduce((n, p) => n + p.stock, 0) + " ml",
                "Volume disponível",
              ],
            ]}
          />
          <div className="stockFilters">
            <label>
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar perfume ou marca"
              />
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Todos</option>
              <option>Árabe</option>
              <option>Nicho</option>
              <option>Designer</option>
            </select>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option>Todas</option>
              {brands.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="products">
            {filtered.map((p) => (
              <div key={p.id}>
                <span>
                  {p.category} · {p.gender || "Unissex"}
                </span>
                <h3>
                  {p.brand} {p.name}
                </h3>
                <p>
                  {p.stock} ml · {brl(p.cost)} por ml
                </p>
                <p className={p.apc ? "apcAvailable" : "apcUnavailable"}>
                  APC: {p.apc ? "1 disponível" : "indisponível"}
                </p>
                <div className="tableActions">
                  <button className="iconButton" onClick={() => edit(p.id)}>
                    <Pencil />
                    Editar
                  </button>
                  <button
                    className="iconButton danger"
                    onClick={() => removeProduct(p.id)}
                  >
                    <Trash2 />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <Cards
            v={[
              [String(d.supplies.length), "Itens"],
              [
                String(d.supplies.reduce((n, s) => n + s.stock, 0)),
                "Quantidade total",
              ],
            ]}
          />
          <div className="products">
            {d.supplies.map((s) => (
              <div key={s.id}>
                <h3>{s.name}</h3>
                <p>
                  {s.stock} {s.unit}
                </p>
                <p>Custo na venda: {s.attachCost ? "Sim" : "Não"}</p>
                <button
                  className="iconButton danger"
                  onClick={() => removeSupply(s.id)}
                >
                  <Trash2 />
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Purchases({
  d,
  set,
  notify,
}: {
  d: D;
  set: any;
  notify: (s: string) => void;
}) {
  const month = today().slice(0, 7),
    monthly = d.purchases.filter((p) => p.date.startsWith(month)),
    spent = monthly.reduce((n, p) => n + p.total, 0);
  function remove(id: number) {
    if (
      !window.confirm(
        "Excluir este registro de compra? O estoque já lançado não será alterado.",
      )
    )
      return;
    set((x: D) => ({
      ...x,
      purchases: x.purchases.filter((p) => p.id !== id),
    }));
    notify("Registro de compra excluído.");
  }
  return (
    <>
      <Cards
        v={[
          [brl(spent), "Gasto em compras neste mês"],
          [String(monthly.length), "Compras no mês"],
        ]}
      />
      <div className="panel table">
        <h2>Histórico de compras</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Fornecedor</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {d.purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{p.supplier}</td>
                <td>{p.type}</td>
                <td>{p.description}</td>
                <td>
                  {p.qty}
                  {p.mlPerBottle ? ` × ${p.mlPerBottle} ml` : ""}
                </td>
                <td>{brl(p.total)}</td>
                <td>
                  <button
                    className="iconButton danger"
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 />
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Clients({
  d,
  history,
  edit,
  set,
  notify,
}: {
  d: D;
  history: (n: number) => void;
  edit: (n: number) => void;
  set: any;
  notify: (s: string) => void;
}) {
  function remove(id: number) {
    if (d.sales.some((s) => s.clientId === id)) {
      window.alert(
        "Este cliente possui vendas registradas e não pode ser excluído.",
      );
      return;
    }
    if (!window.confirm("Excluir este cliente?")) return;
    set((x: D) => ({ ...x, clients: x.clients.filter((c) => c.id !== id) }));
    notify("Cliente excluído.");
  }
  return (
    <div className="clients">
      {d.clients.map((c) => (
        <div key={c.id}>
          <i>
            {c.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)}
          </i>
          <h3>{c.name}</h3>
          <p>
            {c.phone} · CEP {c.cep}
          </p>
          <div className="clientActions">
            <button onClick={() => history(c.id)}>Ver histórico</button>
            <button onClick={() => edit(c.id)}>
              <Pencil />
              Editar
            </button>
            <button className="dangerText" onClick={() => remove(c.id)}>
              <Trash2 />
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
function PaymentBreakdown({ d }: { d: D }) {
  const payments = [
    { name: "Pix", color: "#22a66f" },
    { name: "Cartão de Crédito", color: "#2f80ed" },
    { name: "Dinheiro", color: "#e0b43c" },
    { name: "À prazo", color: "#8b5cf6" },
  ].map((x) => ({
    ...x,
    value: d.sales
      .filter((s) => s.status !== "cancelled" && s.payment === x.name)
      .reduce((n, s) => n + s.total, 0),
  }));
  const total = payments.reduce((n, x) => n + x.value, 0);
  let cursor = 0;
  const gradient = total
    ? `conic-gradient(${payments
        .map((x) => {
          const start = (cursor / total) * 360;
          cursor += x.value;
          return `${x.color} ${start}deg ${(cursor / total) * 360}deg`;
        })
        .join(",")})`
    : "#303b4c";
  return (
    <div className="panel financeChart">
      <div>
        <h2>Vendas por forma de pagamento</h2>
        <p>
          Distribuição do faturamento entre Pix, cartão, dinheiro e vendas a
          prazo.
        </p>
        <div className="paymentDonut" style={{ background: gradient }}>
          <span>
            <small>Total vendido</small>
            <b>{brl(total)}</b>
          </span>
        </div>
      </div>
      <div className="paymentLegend">
        {payments.map((x) => (
          <div key={x.name}>
            <i style={{ background: x.color }} />
            <span>
              {x.name}
              <small>
                {total ? Math.round((x.value / total) * 100) : 0}% do total
              </small>
            </span>
            <b>{brl(x.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function Finance({
  d,
  totals,
  set,
  notify,
}: {
  d: D;
  totals: { gross: number; paid: number };
  set: any;
  notify: (message: string) => void;
}) {
  return (
    <>
      <Cards
        v={[
          [brl(totals.paid), "Recebido"],
          [brl(totals.gross - totals.paid), "A receber"],
          [brl(totals.gross), "Faturamento"],
        ]}
      />
      <PaymentBreakdown d={d} />
      <ProfitControl d={d} set={set} notify={notify} />
    </>
  );
}

function ProfitControl({
  d,
  set,
  notify,
}: {
  d: D;
  set: any;
  notify: (message: string) => void;
}) {
  const sales = d.sales.filter(
    (sale) => sale.status !== "cancelled" && !isNoCost(sale),
  );
  const rows = sales.map((sale) => {
    const perfumeCost = sale.items.reduce(
      (sum, item) =>
        sum +
        item.ml *
          (item.unitCost ??
            d.products.find((p) => p.id === item.productId)?.cost ??
            0),
      0,
    );
    const expenses = Number(sale.expenses || 0);
    const profit = sale.total - perfumeCost - expenses;
    return { sale, perfumeCost, expenses, profit };
  });
  const revenue = rows.reduce((sum, row) => sum + row.sale.total, 0);
  const perfumeCost = rows.reduce((sum, row) => sum + row.perfumeCost, 0);
  const expenses = rows.reduce((sum, row) => sum + row.expenses, 0);
  const profit = revenue - perfumeCost - expenses;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  function setExpense(sale: V) {
    const raw = window.prompt(
      `Despesas do pedido #${sale.id} (embalagem, frete, insumos etc.)`,
      String(sale.expenses || 0).replace(".", ","),
    );
    if (raw === null) return;
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      window.alert("Informe um valor de despesa válido.");
      return;
    }
    set((state: D) => ({
      ...state,
      sales: state.sales.map((item) =>
        item.id === sale.id ? { ...item, expenses: value } : item,
      ),
    }));
    notify(`Despesa do pedido #${sale.id} atualizada.`);
  }
  return (
    <div className="panel profitControl">
      <h2>Margem e despesas por pedido</h2>
      <p>
        Calculado pelo preço vendido, custo por ml do perfume e despesas
        lançadas.
      </p>
      <Cards
        v={[
          [brl(perfumeCost), "Custo dos perfumes"],
          [brl(expenses), "Despesas por pedido"],
          [brl(profit), "Lucro estimado"],
          [`${margin.toFixed(1).replace(".", ",")}%`, "Margem estimada"],
        ]}
      />
      <div className="marginTrack">
        <i style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} />
      </div>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Venda</th>
              <th>Custo perfume</th>
              <th>Despesas</th>
              <th>Lucro</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                sale,
                perfumeCost: cost,
                expenses: expense,
                profit: rowProfit,
              }) => (
                <tr key={sale.id}>
                  <td>#{sale.id}</td>
                  <td>{brl(sale.total)}</td>
                  <td>{brl(cost)}</td>
                  <td>{brl(expense)}</td>
                  <td>{brl(rowProfit)}</td>
                  <td>
                    <button
                      className="iconButton"
                      onClick={() => setExpense(sale)}
                    >
                      <Pencil /> Lançar despesa
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Form({
  modal,
  d,
  set,
  close,
}: {
  modal: Modal;
  d: D;
  set: any;
  close: () => void;
}) {
  const type = modal!.type,
    existingSale = d.sales.find((s) => s.id === modal!.id),
    existingClient = d.clients.find((c) => c.id === modal!.id),
    existingProduct = d.products.find((p) => p.id === modal!.id);
  const existingInstallments = existingSale?.installments?.length
    ? existingSale.installments
    : existingSale?.dueDate
      ? [
          {
            date: existingSale.dueDate,
            amount:
              existingSale.installment ||
              Math.max(0, existingSale.total - existingSale.paid),
          },
        ]
      : [];
  const [pay, setPay] = useState(existingSale?.payment || "Pix"),
    [lines, setLines] = useState(existingSale?.items.length || 1),
    [apcLines, setApcLines] = useState<boolean[]>(
      existingSale?.items.map((item) => Boolean(item.isApc)) || [],
    ),
    [kind, setKind] = useState("Perfume"),
    [newSupplier, setNewSupplier] = useState(false),
    [newClient, setNewClient] = useState(false),
    [addressCount, setAddressCount] = useState(
      existingClient?.addresses.length || 1,
    ),
    [newBrand, setNewBrand] = useState(
      !existingProduct && d.brands.length === 0,
    ),
    [purchaseCalc, setPurchaseCalc] = useState({ qty: 0, ml: 0, total: 0 }),
    [installmentLines, setInstallmentLines] = useState(
      existingInstallments.length || 1,
    ),
    [saleAmounts, setSaleAmounts] = useState({
      total: existingSale?.total || 0,
      paid: existingSale?.paid || 0,
    });
  function submit(e: any) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (type === "sale") {
      const invalid = Array.from({ length: lines }, (_, i) =>
        String(f["productName" + i] || ""),
      ).find(
        (typed) => !d.products.some((p) => `${p.brand} ${p.name}` === typed),
      );
      if (invalid) {
        window.alert(
          `O perfume “${invalid}” não foi encontrado no estoque. Selecione uma opção da busca.`,
        );
        return;
      }
      const apcProducts = Array.from({ length: lines }, (_, i) => {
        if (!apcLines[i]) return null;
        const typed = String(f["productName" + i] || "");
        return d.products.find((p) => `${p.brand} ${p.name}` === typed);
      }).filter(Boolean) as P[];
      if (new Set(apcProducts.map((p) => p.id)).size !== apcProducts.length) {
        window.alert("Só é possível vender um APC de cada perfume por pedido.");
        return;
      }
      const unavailable = apcProducts.find(
        (p) =>
          p.apc < 1 &&
          !existingSale?.items.some((i) => i.productId === p.id && i.isApc),
      );
      if (unavailable) {
        window.alert(
          `O APC de ${unavailable.brand} ${unavailable.name} não está disponível.`,
        );
        return;
      }
    }
    set((x: D) => {
      if (type === "product") {
        const brand = newBrand ? String(f.newBrand) : String(f.brand),
          product = mkP({ ...f, brand }, existingProduct?.id),
          brands = x.brands.includes(brand) ? x.brands : [...x.brands, brand];
        return {
          ...x,
          brands,
          products: existingProduct
            ? x.products.map((p) => (p.id === product.id ? product : p))
            : [...x.products, product],
        };
      }
      if (type === "supply")
        return {
          ...x,
          supplies: [
            ...x.supplies,
            {
              id: Date.now(),
              name: String(f.name),
              stock: Number(f.stock),
              unit: String(f.unit),
              min: 0,
              attachCost: String(f.attachCost) === "Sim",
            },
          ],
        };
      if (type === "client") {
        const c = mkC(f, addressCount, existingClient?.id);
        return {
          ...x,
          clients: existingClient
            ? x.clients.map((v) => (v.id === c.id ? c : v))
            : [...x.clients, c],
        };
      }
      if (type === "purchase") {
        const supplier = newSupplier
            ? String(f.newSupplier)
            : String(f.supplier),
          qty = Number(f.qty),
          mlPerBottle = kind === "Perfume" ? Number(f.mlPerBottle) : undefined,
          total = Number(f.total),
          brand = newBrand ? String(f.newBrand) : String(f.brand || ""),
          description =
            kind === "Perfume"
              ? `${brand} ${String(f.productName)}`.trim()
              : String(f.description);
        const purchase: B = {
          id: Date.now(),
          date: String(f.date),
          supplier,
          type: kind,
          description,
          qty,
          mlPerBottle,
          total,
          attachCost:
            kind === "Suprimento / insumo"
              ? String(f.attachCost) === "Sim"
              : false,
        };
        let products = x.products,
          supplies = x.supplies,
          brands = x.brands;
        if (kind === "Perfume") {
          const volume = qty * (mlPerBottle || 0),
            found = x.products.find(
              (p) =>
                p.brand.toLowerCase() === brand.toLowerCase() &&
                p.name.toLowerCase() === String(f.productName).toLowerCase(),
            );
          products = found
            ? x.products.map((p) =>
                p.id === found.id
                  ? {
                      ...p,
                      stock: p.stock + volume,
                      cost:
                        (p.cost * p.stock + total) / (p.stock + volume || 1),
                      apc: String(f.apc) === "Sim" ? 1 : Math.min(1, p.apc),
                    }
                  : p,
              )
            : [
                ...x.products,
                {
                  id: Date.now() + 1,
                  brand,
                  name: String(f.productName),
                  category: String(f.category),
                  gender: String(f.gender),
                  stock: volume,
                  min: 0,
                  cost: total / (volume || 1),
                  apc: String(f.apc) === "Sim" ? 1 : 0,
                },
              ];
          brands = x.brands.includes(brand) ? x.brands : [...x.brands, brand];
        } else {
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
        }
        return {
          ...x,
          products,
          supplies,
          brands,
          purchases: [purchase, ...x.purchases],
          suppliers: x.suppliers.includes(supplier)
            ? x.suppliers
            : [...x.suppliers, supplier],
        };
      }
      let clientId = Number(f.clientId),
        clients = x.clients;
      if (newClient) {
        clientId = Date.now();
        const address = String(f.newAddress || "");
        clients = [
          ...clients,
          {
            id: clientId,
            name: String(f.newName),
            phone: String(f.newPhone),
            cpf: String(f.newCpf || ""),
            cep: String(f.newCep || ""),
            date: String(f.date),
            addresses: address ? [{ label: "Principal", value: address }] : [],
          },
        ];
      }
      const items = Array.from({ length: lines }, (_, i) => {
        const typed = String(f["productName" + i] || "");
        const product = x.products.find(
          (p) => `${p.brand} ${p.name}` === typed,
        );
        return {
          productId: product?.id || Number(f["product" + i]),
          ml: Number(f["ml" + i]),
          isApc: Boolean(apcLines[i]),
          unitCost: existingSale?.items[i]?.unitCost ?? product?.cost ?? 0,
        };
      });
      const installments =
        pay === "À prazo"
          ? Array.from({ length: installmentLines }, (_, i) => ({
              date: String(f["due" + i] || ""),
              amount: Number(f["installment" + i] || 0),
            })).filter((p) => p.date || p.amount)
          : [];
      const sale: V = {
        id: existingSale?.id || Math.floor(1000 + Math.random() * 8999),
        date: String(f.date),
        clientId,
        items,
        total: Number(f.total),
        paid: Number(f.paid),
        payment: pay,
        paymentNote: pay === "Outro" ? String(f.other) : undefined,
        dueDate: installments[0]?.date,
        installment: installments[0]?.amount,
        installments,
        prepared: existingSale?.prepared || false,
        sent: existingSale?.sent || false,
        status: existingSale?.status || "active",
        expenses: existingSale?.expenses || 0,
      };
      const products = x.products.map((p) => {
        const restored =
            existingSale?.items
              .filter((i) => i.productId === p.id)
              .reduce((n, i) => n + i.ml, 0) || 0,
          newQty = items
            .filter((i) => i.productId === p.id)
            .reduce((n, i) => n + i.ml, 0);
        const restoredApc = existingSale?.items.some(
          (i) => i.productId === p.id && i.isApc,
        )
          ? 1
          : 0;
        const soldApc = items.some((i) => i.productId === p.id && i.isApc)
          ? 1
          : 0;
        return {
          ...p,
          stock: Math.max(0, p.stock + restored - newQty),
          apc: Math.max(0, Math.min(1, p.apc + restoredApc - soldApc)),
        };
      });
      return {
        ...x,
        clients,
        sales: existingSale
          ? x.sales.map((v) => (v.id === sale.id ? sale : v))
          : [sale, ...x.sales],
        products,
      };
    });
    close();
  }
  const title =
    type === "sale"
      ? existingSale
        ? "Editar venda"
        : "Lançar venda"
      : type === "client"
        ? existingClient
          ? "Editar cliente"
          : "Cadastrar cliente"
        : type === "product"
          ? existingProduct
            ? "Editar perfume"
            : "Cadastrar perfume"
          : type === "supply"
            ? "Cadastrar suprimento/insumo"
            : "Registrar compra";
  return (
    <div className="overlay">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>{modal!.id ? "EDIÇÃO" : "NOVO REGISTRO"}</small>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        {type === "sale" ? (
          <>
            <label className="check">
              <input
                type="checkbox"
                onChange={(e) => setNewClient(e.target.checked)}
              />
              Cadastrar cliente nesta venda
            </label>
            {newClient ? (
              <>
                <div className="row three">
                  <Field n="newName" l="Nome" />
                  <Field n="newPhone" l="WhatsApp" />
                  <Field n="newCpf" l="CPF" />
                </div>
                <div className="row">
                  <Field
                    n="newAddress"
                    l="Endereço (opcional)"
                    required={false}
                  />
                  <Field n="newCep" l="CEP (opcional)" required={false} />
                </div>
              </>
            ) : (
              <Select
                n="clientId"
                l="Cliente"
                value={existingSale?.clientId}
                o={d.clients.map((c) => [c.id, c.name])}
              />
            )}{" "}
            {Array.from({ length: lines }, (_, i) => (
              <div className="row item" key={i}>
                <ProductSearch
                  index={i}
                  products={d.products.filter(
                    (p) =>
                      p.stock > 0 ||
                      existingSale?.items.some((x) => x.productId === p.id),
                  )}
                  value={existingSale?.items[i]?.productId}
                />
                <div className="volumeApc">
                  <Field
                    n={"ml" + i}
                    l="Volume (ml)"
                    t="number"
                    v={existingSale?.items[i]?.ml}
                  />
                  <button
                    type="button"
                    className={apcLines[i] ? "apcButton active" : "apcButton"}
                    aria-pressed={Boolean(apcLines[i])}
                    onClick={() =>
                      setApcLines((current) => {
                        const next = [...current];
                        next[i] = !next[i];
                        return next;
                      })
                    }
                  >
                    APC
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="add"
              onClick={() => setLines((n) => n + 1)}
            >
              <Plus />
              Adicionar outro perfume
            </button>
            <div className="row">
              <Field
                n="date"
                l="Data da venda"
                t="date"
                v={existingSale?.date || today()}
              />
              <Field
                n="total"
                l="Valor total"
                t="number"
                v={existingSale?.total}
                onChange={(e) =>
                  setSaleAmounts((v) => ({
                    ...v,
                    total: Number(e.target.value),
                  }))
                }
              />
            </div>
            <Field
              n="paid"
              l="Valor recebido"
              t="number"
              v={existingSale?.paid}
              onChange={(e) =>
                setSaleAmounts((v) => ({ ...v, paid: Number(e.target.value) }))
              }
            />
            <Choices
              label="Forma de pagamento"
              a={["Pix", "Cartão de Crédito", "Dinheiro", "À prazo", "Outro"]}
              v={pay}
              set={setPay}
            />
            {pay === "À prazo" ? (
              <>
                <div className="installmentSummary">
                  <span>
                    Restante a pagar{" "}
                    <b>
                      {brl(Math.max(0, saleAmounts.total - saleAmounts.paid))}
                    </b>
                  </span>
                  <span>
                    {installmentLines} parcela(s) de{" "}
                    <b>
                      {brl(
                        Math.max(0, saleAmounts.total - saleAmounts.paid) /
                          installmentLines,
                      )}
                    </b>
                  </span>
                </div>
                {Array.from({ length: installmentLines }, (_, i) => (
                  <div className="row installmentRow" key={i}>
                    <Field
                      n={"due" + i}
                      l={`Data da parcela ${i + 1}`}
                      t="date"
                      v={existingInstallments[i]?.date}
                    />
                    <label>
                      <span>{`Valor da parcela ${i + 1}`}</span>
                      <input
                        name={"installment" + i}
                        type="number"
                        step="0.01"
                        readOnly
                        value={(
                          Math.max(0, saleAmounts.total - saleAmounts.paid) /
                          installmentLines
                        ).toFixed(2)}
                      />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  className="add"
                  onClick={() => setInstallmentLines((n) => n + 1)}
                >
                  <Plus />
                  Adicionar nova parcela
                </button>
              </>
            ) : null}
            {pay === "Outro" ? (
              <Field
                n="other"
                l="Descrição do item sem custo"
                v={
                  existingSale?.paymentNote ||
                  (!standardPayments.includes(existingSale?.payment || "")
                    ? existingSale?.payment
                    : "")
                }
              />
            ) : null}
          </>
        ) : null}
        {type === "product" ? (
          <ProductFields
            product={existingProduct}
            brands={d.brands}
            newBrand={newBrand}
            setNewBrand={setNewBrand}
          />
        ) : null}
        {type === "supply" ? (
          <>
            <Field n="name" l="Suprimento/insumo" />
            <div className="row">
              <Field n="stock" l="Quantidade" t="number" />
              <Field n="unit" l="Unidade" p="un., caixas..." />
            </div>
            <Choices
              name="attachCost"
              label="Atrelar custo na venda?"
              a={["Sim", "Não"]}
              v="Não"
            />
          </>
        ) : null}
        {type === "purchase" ? (
          <>
            <label className="check">
              <input
                type="checkbox"
                onChange={(e) => setNewSupplier(e.target.checked)}
              />
              Cadastrar fornecedor novo
            </label>
            {newSupplier ? (
              <Field n="newSupplier" l="Novo fornecedor" />
            ) : (
              <Select
                n="supplier"
                l="Fornecedor cadastrado"
                o={d.suppliers.map((s) => [s, s])}
              />
            )}
            <Field n="date" l="Data da compra" t="date" v={today()} />
            <Choices
              label="Item comprado"
              a={["Perfume", "Suprimento / insumo"]}
              v={kind}
              set={setKind}
            />
            {kind === "Perfume" ? (
              <>
                <BrandFields
                  brands={d.brands}
                  newBrand={newBrand}
                  setNewBrand={setNewBrand}
                />
                <Field n="productName" l="Nome do perfume" />
                <Choices
                  name="category"
                  label="Categoria"
                  a={["Nicho", "Árabe", "Designer"]}
                />
                <Choices
                  name="gender"
                  label="Público"
                  a={["Masculino", "Feminino", "Unissex"]}
                />
                <Choices name="apc" label="APC?" a={["Sim", "Não"]} v="Sim" />
                <div className="row three">
                  <Field
                    n="qty"
                    l="Quantidade de frascos"
                    t="number"
                    onChange={(e) =>
                      setPurchaseCalc((v) => ({
                        ...v,
                        qty: Number(e.target.value),
                      }))
                    }
                  />
                  <Field
                    n="mlPerBottle"
                    l="ml por frasco"
                    t="number"
                    onChange={(e) =>
                      setPurchaseCalc((v) => ({
                        ...v,
                        ml: Number(e.target.value),
                      }))
                    }
                  />
                  <Field
                    n="total"
                    l="Valor total"
                    t="number"
                    onChange={(e) =>
                      setPurchaseCalc((v) => ({
                        ...v,
                        total: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="calculated">
                  Custo calculado por ml{" "}
                  <b>
                    {brl(
                      purchaseCalc.total /
                        (purchaseCalc.qty * purchaseCalc.ml || 1),
                    )}
                  </b>
                </div>
              </>
            ) : (
              <>
                <Field n="description" l="Especifique o suprimento / insumo" />
                <div className="row three">
                  <Field n="qty" l="Quantidade" t="number" />
                  <Field n="unit" l="Unidade" p="un., caixas..." />
                  <Field n="total" l="Valor total" t="number" />
                </div>
                <Choices
                  name="attachCost"
                  label="Atrelar custo na venda?"
                  a={["Sim", "Não"]}
                  v="Não"
                />
              </>
            )}
          </>
        ) : null}
        {type === "client" ? (
          <>
            <div className="row">
              <Field n="name" l="Nome completo" v={existingClient?.name} />
              <Field
                n="date"
                l="Data do cadastro"
                t="date"
                v={existingClient?.date || today()}
              />
            </div>
            <div className="row">
              <Field
                n="phone"
                l="Telefone/WhatsApp"
                v={existingClient?.phone}
              />
              <Field n="cpf" l="CPF" v={existingClient?.cpf} />
            </div>
            {Array.from({ length: addressCount }, (_, i) => (
              <div className="addressRow" key={i}>
                <Field
                  n={"address" + i}
                  l={"Endereço " + (i + 1)}
                  v={existingClient?.addresses[i]?.value}
                />
                <Field
                  n={"label" + i}
                  l="Identificação"
                  p="Casa, trabalho..."
                  v={existingClient?.addresses[i]?.label}
                />
                {i === 0 ? (
                  <Field n="cep" l="CEP" v={existingClient?.cep} />
                ) : (
                  <span />
                )}
              </div>
            ))}
            <button
              type="button"
              className="add"
              onClick={() => setAddressCount((n) => n + 1)}
            >
              <Plus />
              Adicionar endereço
            </button>
          </>
        ) : null}
        <footer>
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary">Salvar registro</button>
        </footer>
      </form>
    </div>
  );
}

const mkP = (f: any, id = Date.now()): P => ({
  id,
  brand: String(f.brand),
  name: String(f.name),
  category: String(f.category),
  gender: String(f.gender),
  stock: Number(f.stock),
  min: 0,
  cost: Number(f.cost),
  apc: String(f.apc) === "Sim" ? 1 : 0,
});
const mkC = (f: any, n: number, id = Date.now()): C => ({
  id,
  name: String(f.name),
  phone: String(f.phone),
  cpf: String(f.cpf),
  cep: String(f.cep),
  date: String(f.date),
  addresses: Array.from({ length: n }, (_, i) => ({
    label: String(f["label" + i] || ""),
    value: String(f["address" + i] || ""),
  })).filter((a) => a.value),
});
function BrandFields({
  brands,
  newBrand,
  setNewBrand,
  value,
}: {
  brands: string[];
  newBrand: boolean;
  setNewBrand: (v: boolean) => void;
  value?: string;
}) {
  return (
    <>
      <label className="check">
        <input
          type="checkbox"
          checked={newBrand}
          onChange={(e) => setNewBrand(e.target.checked)}
        />
        Cadastrar nova marca
      </label>
      {newBrand ? (
        <Field n="newBrand" l="Nova marca" />
      ) : (
        <Select
          n="brand"
          l="Marca"
          value={value}
          o={brands.map((x) => [x, x])}
        />
      )}
    </>
  );
}
function ProductFields({
  product,
  brands,
  newBrand,
  setNewBrand,
}: {
  product?: P;
  brands: string[];
  newBrand: boolean;
  setNewBrand: (v: boolean) => void;
}) {
  return (
    <>
      <BrandFields
        brands={brands}
        newBrand={newBrand}
        setNewBrand={setNewBrand}
        value={product?.brand}
      />
      <Field n="name" l="Perfume" v={product?.name} />
      <Choices
        name="category"
        label="Categoria"
        a={["Nicho", "Árabe", "Designer"]}
        v={product?.category}
      />
      <Choices
        name="gender"
        label="Público"
        a={["Masculino", "Feminino", "Unissex"]}
        v={product?.gender}
      />
      <Choices
        name="apc"
        label="APC?"
        a={["Sim", "Não"]}
        v={product ? (product.apc ? "Sim" : "Não") : "Sim"}
      />
      <div className="row">
        <Field n="stock" l="Estoque (ml)" t="number" v={product?.stock} />
        <Field n="cost" l="Custo por ml" t="number" v={product?.cost} />
      </div>
    </>
  );
}
function ProductSearch({
  index,
  products,
  value,
}: {
  index: number;
  products: P[];
  value?: number;
}) {
  const selected = products.find((p) => p.id === value);
  return (
    <label>
      <span>Perfume {index + 1}</span>
      <input
        name={"productName" + index}
        list={"products" + index}
        defaultValue={selected ? `${selected.brand} ${selected.name}` : ""}
        placeholder="Digite para buscar..."
        required
      />
      <datalist id={"products" + index}>
        {products.map((p) => (
          <option key={p.id} value={`${p.brand} ${p.name}`}>
            {p.stock} ml disponíveis · APC{" "}
            {p.apc ? "disponível" : "indisponível"}
          </option>
        ))}
      </datalist>
    </label>
  );
}
function Choices({
  label,
  a,
  v,
  set,
  name,
}: {
  label: string;
  a: string[];
  v?: string;
  set?: (x: string) => void;
  name?: string;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {a.map((x, i) => (
        <label key={x}>
          <input
            type="radio"
            name={name || label}
            value={x}
            checked={set ? v === x : undefined}
            defaultChecked={!set ? (v ? x === v : i === 0) : undefined}
            onChange={() => set?.(x)}
          />
          <span>{x}</span>
        </label>
      ))}
    </fieldset>
  );
}
function Field({
  n,
  l,
  t = "text",
  v,
  p,
  required = true,
  onChange,
}: {
  n: string;
  l: string;
  t?: string;
  v?: string | number;
  p?: string;
  required?: boolean;
  onChange?: (e: any) => void;
}) {
  return (
    <label>
      <span>{l}</span>
      <input
        name={n}
        type={t}
        defaultValue={v}
        placeholder={p}
        required={required}
        step={t === "number" ? "0.01" : undefined}
        onChange={onChange}
      />
    </label>
  );
}
function Select({
  n,
  l,
  o,
  value,
}: {
  n: string;
  l: string;
  o: (string | number)[][];
  value?: string | number;
}) {
  return (
    <label>
      <span>{l}</span>
      <select name={n} required defaultValue={value ?? ""}>
        <option value="" disabled>
          Selecione...
        </option>
        {o.map((x, i) => (
          <option key={i} value={x[0]}>
            {x[1]}
          </option>
        ))}
      </select>
    </label>
  );
}
function History({ id, d, close }: { id: number; d: D; close: () => void }) {
  const c = d.clients.find((c) => c.id === id);
  return (
    <div className="overlay">
      <div className="history">
        <header>
          <h2>{c?.name}</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <p>CEP: {c?.cep}</p>
        {c?.addresses.map((a, i) => (
          <p key={i}>
            <b>{a.label}</b> {a.value}
          </p>
        ))}
        <Sales d={{ ...d, sales: d.sales.filter((s) => s.clientId === id) }} />
      </div>
    </div>
  );
}
