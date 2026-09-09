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
  Building2,
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
  Printer,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { automaticPackaging, packaging, packagingOptions, PACKAGING_RULES } from "./packaging";
import { captureReport } from "./report";
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
  pendingLots?: {
    purchaseId: number;
    qty: number;
    cost: number;
    unit?: string;
  }[];
};
type C = {
  id: number;
  name: string;
  phone: string;
  cpf: string;
  cep: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  date: string;
  addresses: {
    label: string;
    value: string;
    district?: string;
    city?: string;
    state?: string;
  }[];
};
type L = { productId: number; ml: number; isApc?: boolean; unitCost?: number };
type Installment = { date: string; amount: number; paid?: boolean };
type V = {
  id: number;
  date: string;
  clientId: number;
  customerName?: string;
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
  supplyOverrides?: Record<string, number>;
  channel?: "direct" | "marketplace";
  marketplace?: "TikTok Shop" | "Shopee";
  marketplaceFee?: number;
  marketplacePayoutReceived?: boolean;
  shippingCost?: number;
  shippingPaidBy?: "client" | "daf";
  shippingMethod?:
    | "Correios"
    | "Loggi"
    | "Jadlog"
    | "Uber/Pessoalmente"
    | "TikTok Shop"
    | "Shopee";
  accumulatingDecants?: boolean;
  preparationStatus?: "preparing" | "accumulating" | "waiting";
  historical?: boolean;
  description?: string;
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
  orderSequenceVersion?: number;
  supplyInventoryVersion?: number;
  marketplacePayoutDays?: { "TikTok Shop": number; Shopee: number };
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
  marketplacePayoutDays: { "TikTok Shop": 9, Shopee: 7 },
};
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseDecimal = (value: unknown) =>
  Number(String(value ?? "").trim().replace(",", ".")) || 0;
const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const dateBR = (value?: string) => {
  if (!value) return "Não informada";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const orderNo = (id: number) => String(id).padStart(5, "0");
const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
  "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
  "RR", "SC", "SP", "SE", "TO",
];
const isMarketplaceSale = (sale: V) =>
  sale.channel === "marketplace" || Boolean(sale.marketplace);
const isHistoricalSale = (sale: V) =>
  Boolean(sale.historical) ||
  (!isMarketplaceSale(sale) && (sale.items || []).length === 0);
const isInstallmentSale = (sale: V) =>
  sale.payment === "À prazo" ||
  Boolean(sale.dueDate) ||
  Boolean(sale.installments?.length);
const isInstallmentSettled = (sale: V) => {
  const installments = (sale.installments || []).filter(
    (installment) => installment.amount > 0,
  );
  return installments.length
    ? installments.every((installment) => installment.paid)
    : sale.paid >= sale.total;
};
const isSaleSettled = (sale: V) =>
  isInstallmentSale(sale)
    ? isInstallmentSettled(sale)
    : sale.paid >= sale.total;
const marketplacePending = (sale: V) =>
  isMarketplaceSale(sale) && !sale.marketplacePayoutReceived;
const amountDue = (sale: V) =>
  marketplacePending(sale)
    ? Math.max(0, sale.total)
    : Math.max(0, sale.total - sale.paid);
const getPreparationStatus = (sale: V) =>
  sale.preparationStatus ||
  (sale.accumulatingDecants ? "accumulating" : "preparing");
const shippingClass = (method?: string) =>
  (method || "não informado")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, "-");
const supplyStockKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function activateNextSupplyLot(supply: S): S {
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
const saleCustomer = (sale: V, data: D) =>
  sale.customerName ||
  data.clients.find((client) => client.id === sale.clientId)?.name ||
  "Cliente não informado";
const LOGO =
  "data:image/webp;base64,UklGRlgOAABXRUJQVlA4IEwOAAAQTQCdASpoAf0APpFEn0ulo6Kho3FJ2LASCWNu4IeNgePWGfWvwG9ZytXb8Sl51zd51P9j6lPMA50PmE/mf+f9X7/berP+veoB/T/8d1sHoHfuR1w395yZbzb/ce4j/d2Sn7zZ+e1ngEPB7QL2q+68Q/2S1vSgB4uWjF6v9TQZiTWElilA0cxqUH15xtGkk6KLOi+MBq7jhNYSWKUDRz6+AclVlFnResJLFKBo6f85i8/A1m9vXNda1v6Osiv/Uzz1LPxx7OikAJck4jd/f9LIL+q3NwbfkP0MsobHjjgo9mw/BJFFQZyiCVI+a/FXkUmgesiMacb9SDHRLDuL7mwNVJBmRE3AddK23yJhoDFlEuxtpA3aGf0g7Z3KEUHWF2cFGT4lrbC4ZgC2LabCXJGrmM2Sa665TW1wsxdUwbPWoQZzdj5kIfolokz7db5UxPad1UZdUkI02EuSR/Qso/xQVfTVnzFiJ71pVL2aS2slYKMxPpFhbeMUrfGXMyJJ9Em9GHc6VUozaTRZN/Pfdqp0eK3lrywbEg6APQTIQt4hcsjz7Gac/pcvBBba96pDrfi9j8wD/SfMcWbNjonbkqgCN4mBPCW52CJN9cGi6zfhsdCr3dW26RVhBe0/vOsF3vxeAeqk2Q4C6vD1rjEv6t3ipqmu01O+O6eU1VDymv9z+TSa/P0EToJbJ2s/85BxvkHFJol4y1AnjuCQnRsAw8cCmDoy/vM6bdNTJSH4BQczZ7PmjqANVF1gRvL7IvaqSIleT61wKRQY8ryFLL3KT5ezEV3xgNG9Xvh7JcZosHU5XKBJ2PQ3B+UXPrzjlQk9NCQAAP76SRBO49Yr6JmUoYAAJ0AAGsgAEtMUZnF/jzd/3tQnk8/l+xRSAcD0GPKMJ8VThIm3ckKW+4Irj/l38UnBjc3F6jDxqj9oz/mptOQsJVotBZ4m/f8bwd+Xscp1ss6kaAyTtOKKRWLClfz81ti3Dg50OTMusn5hwxj6+ib6VoYOWEG9pk7ogsYHpFfV+5Qam4qOZrzH/I6GRL8Lw5xiiJZQhRXQFt5wonnIVQRpd45de/2d6U+z4czZ/3MwL0jZXCGdA5HPiJ/7aDepbCXmZI00zkCyvmUjrXaBO5nEprss7NPvBsvHVEIQOE+nuLMvXprL5AIR+QGsJD1fXSOzOaNQXIZvjyj2raOjl8QfAfQwre5ltwRWjC2zjTyFHbM5k3Vg9KQdnrE4UHGqsLmZLCznxFH5o0Ikf+MvP2/CF7MT+rnl7Y2G+O+HQETv2YdMEEgbaCl2JM8SKVNFkfax/qPT0dzjK6NJuZmAtWhe2XgCqL1IpOifVcwPK7sBO9xGaIqQanxbowGghaI8j4Ym39iCHpqusU6sAAFILkONX3kbgwFAuQ1tslAkuxBWXcUtStlrPLJ62/e2jasTX0+AqC8IDy1IyvRsA2ukBdzmmmTI3TIenzRrJRLnNhubByeWk78hWsHbnszHQZRLk5j2jkF9a0MR6HfXW8vzU7Ztt2xvYia9MsDgDzXZu6PD+4vKLEOhLLbcRBcBen8PZ4qujhf/F41nHyoL89C6SNKTSbv2pTxJQPNknTfUS10fy3m7dTZ6f6QcOTTVW8BrHSaLY3moAzCtsbu8hfCjkEwnOMpzosUa97xQo33/NCrHpmenIcujbbdt8JlurninkQprFt6jX7iBywdu/ZD3SF+tfEbCMREq40HS5KGYBLGOHeLQGMmUvDi26NvYcV8Jc+jyNbavfC7K4/FueYI9rjIfjBUfmGHCR7R46ewGdkPyvVkMJmxjPVaxzIYrXzQKkvV8dsLRYFiKQNLbH6WXeOK5wwlrPYzRCvqFju/nASe77sz6Pe6NZ7EIzpIu1fCtcsiIDzNn0d5J75iEBfx0fR67Rto9Rkr2pD+B3JcjS+ox5/qNMTTuYYZKTNbaxrPPVpfnPdFKf+lpJWDUbvjDdj+PcK/C4ov4318R7mW1R6lmdRufTwua5ARePLbupLyBVZMJNamcVnRo4lAtQN4pFPppK/I6D7S8iNoDqz0uLc09qKGaBtusWisqnt+vZANOBszF329G4qqpTyMxSSzqlPTCxG+43klABAgioYy0uNgTe8sSvGqcLmBzb8sh31/ECPamigGn8sVjAXz9Wa9Ag3KzV4PDWJ4Q7sVw5KOC43LoJWlMWNB/bfev9qMQgbvDQdahXnYDHuxdwoNG72tvU/LrtzNHKjZyuQ+UuL9nbdDfm0nJaeQ5PoRdpT9wJ6xl7xrLyhY3aXRJWWtmGLQ3yOCV6ItPsWl8X9DE7r361m230JHapVqJLrjK2dLq4lPu4N9WgK7UiPnpQwutLTtEzm9kwliYq4QKQ2d+jKHD3ALTB5kMbCeTIFGvTiRXAsPXzpyM/0rIZN0hwZ/hCa670HypE4EY5cemxK1G83eKJVr6k5mwHVZ54q0UghqEa4XLjnC29O+34tLXzp4ZmhqjDnFf2beV+H3xYRJbLtz3z00vYSWTgjgxyPfysFM+zB8ClWHirYWw/ie2VJXARk3yGyWevkZW5l5UOTlWQRc4lUVtwo10TsBzRgsTBkIQo23fGYnstZcli1+FA6OIhQVNs/iWW/29DWcaM8BtjXaGS9w2n4/IMwtRFZ2saZkmKBzXRYirp2Dvw3zMl2YZt7Thnqt4uqeNs4KJu2i/tYVWq+y9+Ow+fUHwMYWH/DivSWngrvKmY4XwG/3ew8XRguFGKAp/DoKuwoueXFEus7WJ3JHr9xhpVccMku8zKqoHq9sLPMZV4JhfRnERMDFXyxELZdEs51ZRFXJ0i3hih7htvpJ1g2dN049svBERpuvL08VYJ5nJc7vLvfKlZn7EFuDFRo7IUmJlW0/OvkJB96JEi5B4Ri6TvZUULUdnc9RwB6lHqFnjaEdePeUM71DPyxOmMj6j+CH5sV2/jRsWjVqIJStmofWmLjVg1MlbZhggADpOu6sJChpaLAShKxH1hvonTHZrR28k+xH7j/JLeUVDgUjF0MXUCazk4AvrhyYRv0fjrRMs5ukQWu7PNNZDImkW596ia9exKzSfCSIJZod49StuGJ1/wTDbmdvI3zO0V1J8trwaFNSQTntE8bvao2pa/j5H/cbfsy4Rbe4Hck9kWK0yVs7AgXoDxTvw4gxGrHsvMDQqQCX2zRkgLu8VWLvlTmEcGjbUeebxHsEFIixWxWQ+bWHxbJNFiHzEZwxzb/IyClWCwv3rBQPHWd+EbzXIJRR0pSMZLCs2qSDfhVgiLE+VrdjRFY5/WhpEkd/+roVPOLggneikEMX3aDFuPWzucprvbX1wqWNfn35UzzB51+6DHNBEvRog52ooUP+BcTH6uHlpLPE4w6bY3JWFvL7ujXcOLNu5ipPZ9Yk5bPN/Xrr76x1HXKlhD2XgYfyml0KExfrC14PIiCEgsj5yY7QQv11uH/FcFlu6zOgrVr/9pg/YIPJ3EfevhNI536c4BreZ+eNeOc391OlXt8UGQjOKV7uHHiRDO2ccFKsoI5k9053ZL+8n5DmMDnCgKmKOlf12CgBilqE0nudRMAOUG0g0LAtPGFVpxWUum5wkhNgCd8reErBkmEhRa98gVzmqC4Mfen88alD9ZznufXDYxEIDQcrWZnJxqJ33RjWPcmbKEeg3CuHslbK794Q/1zOr1uiyebQzUyS4ksb0CdfAQYdJCqN4IYvN+CIgxtHzd5KN/XeDVcI0y6maOlxJhm7k9KBX3ngaj+O3epnMQFAPSaJvGfLtCDI8R/r7vIkzzOjT1rs//AaHbx25nx3l89jT/p13c3vR+d7p7ux0dLwwUEPpPJs+cVDYjVobEWgWo/FMwU+E+e945vE7nUqlBX4c44TcAp1XjJcfGeaQ1HP/Dc1hjr30PdwhoTVP086ScpWbdymsSpbJQF8eudMhZWeXy/X+nVlO//+DLgY7MOLdzB4KZzAaWDSx+0TlMSQXShqeWDV0iO1bMWWOfjVDV31PCkXcq4GfvbFLKFtujo6mpVhceZ5OuCFXuDbmVQPxLBDom2cLxSN2dWL3nAqpMgcKRZYGqeVkUVqqoAwHQj5Gy3GL8IW9cFCL+7HoXaDquap1AS7rwtowJ1wcCTuq7vEH7f65How0umPeK8mbFliAAeqb39+xdQiTHPD/scIC5C17R+qVUkXkeU0FRsaXRE7Hq1RJ2HM0l09PwXdyKnvFdAyhLr3oG7U6eNtE+sFNRxIkyChaFSn1wMDXmO2gm5xBcIwh6q4XCHWlXM94YylMvrmQIA6PC6ZsSHkROCn/LNJV0SFySAYv6TWYZouy76C312Q9oz886ukNaOKC7foy++R4bLq4JThOrU0TtpEcAGAmaLrpZAager9ozTeAtx7TBdkJG8oV5tl2+gcjH3o/2HbErTWP0mUAqToPXmD0npr58v/i1xX5u3xkJA0aanmH5yN553gupj37ridofa4g4MgjcWsm0S1LzobJNvFh5KvHPlcMT+8w/9JAItFw4Vu5X7TN2M1sHhDP9PzQyF/196Qk6IjX7yMRYIBjf70n0CCLCmwjQHUeXbRIjxDVQY65c2v8X4ODk5fOiMF1tF9HTpF6yCb0Z8cEP87zyI+o5oqpDdMGfAUlrm9SzxPQYokxng041B5/2fh3RSwDjU8zOqNZuzPYByguz5M7rfoil8HQb4vXoEIshx+5WfuQgRoUDh/ruELzYHZqpQ39BtDbqL3e3NTzrQwGDd8itLU97IzmTw3LoyG8zftrgdKo1zMYxIPRTyuawYa6NdEmDUc5lEyHvb3khGoI2KP7QyohhQsz5EzU8CYpEL3OIoJ/GrDLMjaCRUPmpO9rEjN454ARdgPvELwdi4QCcOHAAAIRAVKAB++gAL1XAAHRNvqpB83ywAA=";
const nav = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["sales", "Vendas", ShoppingBag],
  ["prepare", "Pedidos para preparar", ClipboardCheck],
  ["shipping", "Envios", Truck],
  ["stock", "Estoque", Box],
  ["purchases", "Compras", ShoppingCart],
  ["clients", "Clientes", Users],
  ["suppliers", "Fornecedores", Building2],
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
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  const [page, setPage] = useState("dashboard"),
    [modal, setModal] = useState<Modal>(null),
    [history, setHistory] = useState(0),
    [supplierHistory, setSupplierHistory] = useState(""),
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
    const version = ++saveVersion.current;
    setSync("loading");
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const { error } = await supabase
            .from("app_state")
            .upsert({ user_id: session.user.id, data });
          if (version === saveVersion.current) {
            setSync(error ? "error" : "saved");
          }
        } catch {
          if (version === saveVersion.current) setSync("error");
        }
      });
  }, [data, ready, session.user.id]);
  const totals = useMemo(
    () =>
      data.sales
        .filter(
          (s) =>
            s.status !== "cancelled" &&
            !isNoCost(s) &&
            !isHistoricalSale(s),
        )
        .reduce(
          (a, s) => ({ gross: a.gross + s.total, paid: a.paid + s.paid }),
          { gross: 0, paid: 0 },
        ),
    [data.sales],
  );
  const navAlerts: Record<string, number> = {
    receivables: data.sales.filter(
      (s) =>
        s.status !== "cancelled" &&
        !isNoCost(s) &&
        !isMarketplaceSale(s) &&
        s.paid < s.total,
    ).length,
    prepare: data.sales.filter(
      (sale) =>
        sale.status !== "cancelled" &&
        !sale.prepared &&
        !isHistoricalSale(sale),
    ).length,
    shipping: data.sales.filter(
      (sale) =>
        sale.status !== "cancelled" &&
        sale.prepared &&
        !sale.sent &&
        !isHistoricalSale(sale),
    ).length,
  };
  const action =
    page === "sales"
      ? ["Nova venda", "sale"]
      : page === "purchases"
        ? ["Nova compra/despesa", "purchase"]
        : page === "clients"
          ? ["Novo cliente", "client"]
          : page === "suppliers"
            ? ["Novo fornecedor", "supplier"]
            : page === "receivables"
            ? ["Cadastrar venda antiga", "oldSale"]
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
              {navAlerts[id] ? (
                <span
                  className="navAlert"
                  aria-label={`${navAlerts[id]} pendente(s)`}
                >
                  {navAlerts[id]}
                </span>
              ) : null}
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
          <div className="headerActions">
            {page === "dashboard" || page === "finance" ? (
              <button
                className="secondary reportButton"
                onClick={() =>
                  captureReport().catch(() =>
                    notify(
                      "Não foi possível capturar o painel. Tente novamente.",
                    ),
                  )
                }
              >
                <Printer /> Capturar relatório (PNG)
              </button>
            ) : null}
            {page === "sales" ? (
              <button
                className="secondary marketplaceButton"
                onClick={() => setModal({ type: "marketplace" })}
              >
                <ShoppingBag /> Marketplace
              </button>
            ) : null}
            {action ? (
              <button
                className="primary"
                onClick={() => setModal({ type: action[1] })}
              >
                <Plus />
                {action[0]}
              </button>
            ) : null}
          </div>
        </header>
        <section className="content">
          {page === "dashboard" ? (
            <Dash d={data} />
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
              addProduct={() => setModal({ type: "product" })}
              editSupply={(id) => setModal({ type: "supplyEdit", id })}
              edit={(id) => setModal({ type: "product", id })}
              notify={notify}
            />
          ) : page === "purchases" ? (
            <Purchases
              d={data}
              set={setData}
              notify={notify}
              edit={(id) => setModal({ type: "purchaseEdit", id })}
            />
          ) : page === "clients" ? (
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
          )}
        </section>
      </main>
      {modal?.type === "supplyEdit" || modal?.type === "purchaseEdit" ? (
        <InventoryEdit
          modal={modal}
          d={data}
          set={setData}
          close={() => setModal(null)}
        />
      ) : modal ? (
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
      {supplierHistory ? (
        <SupplierHistory
          name={supplierHistory}
          d={data}
          close={() => setSupplierHistory("")}
        />
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
  const cleanSupplierName = (value: unknown) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  const supplierKey = (value: unknown) =>
    cleanSupplierName(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const supplierByKey = new Map<string, string>();
  [
    ...(merged.suppliers || []),
    ...(merged.purchases || []).map((purchase: B) => purchase.supplier),
  ]
    .map(cleanSupplierName)
    .filter(Boolean)
    .forEach((name) => {
      const key = supplierKey(name);
      if (!supplierByKey.has(key)) supplierByKey.set(key, name);
    });
  const suppliers = [...supplierByKey.values()];
  const purchases = (merged.purchases || []).map((purchase: B) => {
    const cleaned = cleanSupplierName(purchase.supplier);
    return {
      ...purchase,
      supplier: supplierByKey.get(supplierKey(cleaned)) || cleaned,
    };
  });
  const rawSales = (merged.sales || []) as V[];
  const ids = rawSales.map((sale) => sale.id).sort((a, b) => a - b);
  const needsSequentialIds =
    !merged.orderSequenceVersion && ids.some((id, index) => id !== index + 1);
  const sequentialIds = new Map<number, number>();
  if (needsSequentialIds) {
    [...rawSales]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .forEach((sale, index) => sequentialIds.set(sale.id, index + 1));
  }
  const normalizedSales = rawSales.map((s: V) => {
    const marketplaceSale = isMarketplaceSale(s);
    const linkedCustomer = merged.clients.find(
      (client: C) => client.id === s.clientId,
    );
    return {
      ...s,
      id: needsSequentialIds ? sequentialIds.get(s.id) || s.id : s.id,
      clientId: marketplaceSale ? 0 : s.clientId,
      customerName:
        s.customerName || (marketplaceSale ? linkedCustomer?.name : undefined),
      payment: marketplaceSale ? "À prazo" : s.payment,
      sent: Boolean(s.sent),
      status: s.status || "active",
      expenses: Number(s.expenses || 0),
      supplyOverrides: Object.fromEntries(
        Object.entries(s.supplyOverrides || {}).map(([name, qty]) => [
          name,
          Math.max(0, Number(qty) || 0),
        ]),
      ),
      channel: s.channel || "direct",
      marketplaceFee: Number(s.marketplaceFee || 0),
      marketplacePayoutReceived: Boolean(s.marketplacePayoutReceived),
      shippingCost: Number(s.shippingCost || 0),
      shippingPaidBy:
        s.shippingPaidBy || (Number(s.shippingCost || 0) > 0 ? "daf" : "client"),
      accumulatingDecants: Boolean(s.accumulatingDecants),
      historical:
        Boolean(s.historical) ||
        (!marketplaceSale && (s.items || []).length === 0),
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
    } as V;
  });
  let normalizedSupplies = (merged.supplies || []).map((s: S) => ({
    ...s,
    attachCost: Boolean(s.attachCost),
    pendingLots: (s.pendingLots || []).map((lot) => ({
      ...lot,
      qty: Math.max(0, Number(lot.qty) || 0),
      cost: Math.max(0, Number(lot.cost) || 0),
    })),
  }));
  if (!merged.supplyInventoryVersion) {
    normalizedSales.forEach((sale) => {
      normalizedSupplies = moveSupplyStock(normalizedSupplies, sale, -1);
    });
  }
  normalizedSupplies = normalizedSupplies.map(activateNextSupplyLot);
  return {
    ...merged,
    products,
    orderSequenceVersion: 1,
    supplyInventoryVersion: 1,
    marketplacePayoutDays: {
      "TikTok Shop": Number(merged.marketplacePayoutDays?.["TikTok Shop"] || 9),
      Shopee: Number(merged.marketplacePayoutDays?.Shopee || 7),
    },
    purchases,
    supplies: normalizedSupplies,
    suppliers,
    brands,
    sales: normalizedSales,
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

function Dash({ d }: { d: D }) {
  const now = new Date(),
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    monthSales = d.sales.filter((sale) => sale.date.startsWith(monthKey)),
    activeSales = monthSales.filter(
      (sale) =>
        sale.status !== "cancelled" &&
        !isNoCost(sale) &&
        !isHistoricalSale(sale),
    ),
    days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    day = now.getDate();
  const monthTotals = activeSales.reduce(
    (acc, sale) => ({
      gross: acc.gross + sale.total,
      paid: acc.paid + Math.min(sale.total, Math.max(0, sale.paid)),
    }),
    { gross: 0, paid: 0 },
  );
  const estimatedProfit = activeSales.reduce((sum, sale) => {
    const perfumeCost = sale.items.reduce(
      (cost, item) =>
        cost +
        item.ml *
          (item.unitCost ??
            d.products.find((product) => product.id === item.productId)?.cost ??
            0),
      0,
    );
    const expenses =
      Number(sale.expenses || 0) +
      Number(sale.marketplaceFee || 0) +
      Number(sale.shippingCost || 0) +
      packaging(sale, d.supplies).total;
    return sum + sale.total - perfumeCost - expenses;
  }, 0);
  const daily = Array.from({ length: days }, (_, i) =>
    activeSales
      .filter((s) => new Date(s.date + "T12:00").getDate() === i + 1)
      .reduce((n, s) => n + Math.max(0, s.paid), 0),
  );
  const avg = daily.slice(0, day).reduce((n, v) => n + v, 0) / Math.max(1, day),
    max = Math.max(avg, ...daily, 1);
  const categories = ["Nicho", "Árabe", "Designer"].map((category) => ({
    category,
    value: activeSales.reduce(
      (sum, s) =>
        sum +
        s.items
        .filter(
          (x) =>
            d.products.find((p) => p.id === x.productId)?.category === category,
        )
        .reduce((n, x) => n + x.ml, 0),
      0,
    ),
  }));
  const catTotal = categories.reduce((n, x) => n + x.value, 0),
    catMax = Math.max(1, ...categories.map((x) => x.value));
  const paid = activeSales.filter(isSaleSettled).length,
    open = activeSales.filter((sale) => !isSaleSettled(sale)).length,
    cancelled = monthSales.filter(
      (s) => s.status === "cancelled" && !isHistoricalSale(s),
    ).length,
    count = paid + open + cancelled;
  const a = count ? (paid / count) * 360 : 0,
    b = count ? ((paid + open) / count) * 360 : 0;
  return (
    <>
      <div className="cards dashboardCards">
        <div>
          <span>Faturamento mensal</span>
          <b>{brl(monthTotals.gross)}</b>
        </div>
        <div className="splitCard">
          <div>
            <span>Total recebido</span>
            <b>{brl(monthTotals.paid)}</b>
          </div>
          <div>
            <span>A receber</span>
            <b>{brl(Math.max(0, monthTotals.gross - monthTotals.paid))}</b>
          </div>
        </div>
        <div>
          <span>Lucro estimado</span>
          <b>{brl(estimatedProfit)}</b>
        </div>
        <div className="splitCard">
          <div>
            <span>Ticket médio</span>
            <b>{brl(monthTotals.gross / (activeSales.length || 1))}</b>
          </div>
          <div>
            <span>Pedidos no mês</span>
            <b>{activeSales.length}</b>
          </div>
        </div>
      </div>
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
                <b>
                  {Math.round(
                    (monthTotals.paid / (monthTotals.gross || 1)) * 100,
                  )}%
                </b>
                <small>recebido</small>
              </span>
            </div>
            <p className="green">
              Pagos <b>{paid}</b>
            </p>
            <p className="yellow">
              Pendentes e parciais <b>{open}</b>
            </p>
            <p className="red">
              Cancelados <b>{cancelled}</b>
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
                    <b>{x.value.toLocaleString("pt-BR")} ml</b>
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

function MarketplaceSummary({ sales }: { sales: V[] }) {
  const gross = sales.reduce((sum, sale) => sum + Math.max(0, sale.paid), 0);
  const tiktok = sales
    .filter((sale) => sale.marketplace === "TikTok Shop")
    .reduce((sum, sale) => sum + Math.max(0, sale.paid), 0);
  const shopee = sales
    .filter((sale) => sale.marketplace === "Shopee")
    .reduce((sum, sale) => sum + Math.max(0, sale.paid), 0);
  return (
    <div className="panel marketplaceSummary">
      <div>
        <span>Faturamento Marketplace</span>
        <b>{brl(gross)}</b>
        <small>{sales.length} venda(s) cadastrada(s)</small>
      </div>
      <div>
        <span>TikTok Shop</span>
        <b>{brl(tiktok)}</b>
      </div>
      <div>
        <span>Shopee</span>
        <b>{brl(shopee)}</b>
      </div>
    </div>
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
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [showFilters, setShowFilters] = useState(false);
  const [saleDay, setSaleDay] = useState("");
  const [origin, setOrigin] = useState("all");
  const [saleStatus, setSaleStatus] = useState("all");
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00`));
  function shiftMonth(delta: number) {
    const base = new Date(`${month}-01T12:00:00`);
    base.setMonth(base.getMonth() + delta);
    setMonth(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`);
    setSaleDay("");
  }
  const filteredSales = d.sales.filter((sale) => {
    if (isHistoricalSale(sale)) return false;
    const customer = saleCustomer(sale, d).toLowerCase();
    const matchesStatus =
      saleStatus === "all" ||
      (saleStatus === "paid" &&
        sale.status !== "cancelled" &&
        sale.paid >= sale.total) ||
      (saleStatus === "open" &&
        sale.status !== "cancelled" &&
        !isMarketplaceSale(sale) &&
        sale.paid < sale.total) ||
      (saleStatus === "marketplace" &&
        sale.status !== "cancelled" &&
        isMarketplaceSale(sale)) ||
      (saleStatus === "cancelled" && sale.status === "cancelled");
    return (
      customer.includes(query.trim().toLowerCase()) &&
      sale.date.startsWith(month) &&
      (!saleDay || sale.date === saleDay) &&
      (origin === "all" ||
        (origin === "marketplace" && isMarketplaceSale(sale)) ||
        (origin === "direct" && !isMarketplaceSale(sale))) &&
      matchesStatus
    );
  });
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
      !window.confirm(
        `Cancelar o pedido #${orderNo(s.id)}? O estoque será devolvido.`,
      )
    )
      return;
    set((x: D) => ({
      ...x,
      products: restoreStock(x, s),
      supplies: moveSupplyStock(x.supplies, s, 1),
      sales: x.sales.map((v) =>
        v.id === s.id ? { ...v, status: "cancelled" } : v,
      ),
    }));
    notify?.("Venda cancelada e estoque devolvido.");
  }
  function remove(s: V) {
    if (
      !set ||
      !window.confirm(`Excluir definitivamente o pedido #${orderNo(s.id)}?`)
    )
      return;
    set((x: D) => ({
      ...x,
      products: s.status === "cancelled" ? x.products : restoreStock(x, s),
      supplies:
        s.status === "cancelled"
          ? x.supplies
          : moveSupplyStock(x.supplies, s, 1),
      sales: x.sales.filter((v) => v.id !== s.id),
    }));
    notify?.("Venda excluída.");
  }
  return (
    <div className="panel table">
      <h2>Vendas</h2>
      <div className="salesToolbar">
        <label className="salesSearch">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar pelo nome do cliente"
          />
        </label>
        <div className="monthPicker" aria-label="Mês das vendas">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft />
          </button>
          <b>{monthLabel}</b>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
            <ChevronRight />
          </button>
        </div>
        <button
          type="button"
          className="filterButton"
          onClick={() => setShowFilters((visible) => !visible)}
        >
          <SlidersHorizontal /> Filtrar
        </button>
      </div>
      {showFilters ? (
        <div className="salesFilters">
          <label>
            <span>Dia</span>
            <input
              type="date"
              value={saleDay}
              onChange={(event) => {
                setSaleDay(event.target.value);
                if (event.target.value) setMonth(event.target.value.slice(0, 7));
              }}
            />
          </label>
          <label>
            <span>Origem</span>
            <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
              <option value="all">Todas</option>
              <option value="direct">Venda direta</option>
              <option value="marketplace">Marketplace</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={saleStatus} onChange={(event) => setSaleStatus(event.target.value)}>
              <option value="all">Todos</option>
              <option value="paid">Pago</option>
              <option value="open">A prazo</option>
              <option value="marketplace">Marketplace</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <button type="button" onClick={() => { setSaleDay(""); setOrigin("all"); setSaleStatus("all"); }}>
            Limpar filtros
          </button>
        </div>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Produtos</th>
            <th>Pagamento</th>
            <th>Origem</th>
            <th>Total</th>
            <th>Status</th>
            {edit ? <th>Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {filteredSales.map((s) => (
            <tr
              key={s.id}
              className={s.status === "cancelled" ? "cancelled" : ""}
            >
              <td>
                #{orderNo(s.id)}
                <small>{dateBR(s.date)}</small>
                {s.status === "cancelled" ? <em>Cancelada</em> : null}
              </td>
              <td>{saleCustomer(s, d)}</td>
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
                    {dateBR(s.dueDate)} · {brl(s.installment || 0)}
                  </small>
                ) : null}
              </td>
              <td>
                {isMarketplaceSale(s) ? s.marketplace || "Marketplace" : "Venda direta"}
                {s.marketplaceFee ? (
                  <small>Taxa: {brl(s.marketplaceFee)}</small>
                ) : null}
              </td>
              <td>
                {brl(s.total)}
                <small>Insumos: {brl(packaging(s, d.supplies).total)}</small>
              </td>
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
      {!filteredSales.length ? <p className="empty">Nenhuma venda encontrada.</p> : null}
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
      : isMarketplaceSale(s)
        ? "Marketplace"
      : isNoCost(s)
        ? "Sem custo"
        : isSaleSettled(s)
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

function saleOriginBadge(s: V) {
  const label = isMarketplaceSale(s) ? s.marketplace || "Marketplace" : "Venda direta";
  const css = isMarketplaceSale(s)
    ? s.marketplace === "TikTok Shop"
      ? "tiktok"
      : "shopee"
    : "direct";
  return <strong className={`prepareOrigin ${css}`}>{label}</strong>;
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
  const [shippingSale, setShippingSale] = useState<V | null>(null);
  const list = d.sales.filter(
    (s) =>
      s.status !== "cancelled" &&
      !isHistoricalSale(s) &&
      (tab === "done" ? s.prepared : !s.prepared),
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
        ? `Pedido #${orderNo(s.id)} movido para Finalizados.`
        : `Pedido #${orderNo(s.id)} voltou para A preparar.`,
    );
  }
  function prepareSale(s: V) {
    if (isMarketplaceSale(s)) {
      const shippingMethod = s.marketplace || "TikTok Shop";
      set((state: D) => ({
        ...state,
        sales: state.sales.map((sale) =>
          sale.id === s.id
            ? { ...sale, prepared: true, sent: false, shippingMethod }
            : sale,
        ),
      }));
      notify(
        `Pedido #${orderNo(s.id)} finalizado para envio pela ${shippingMethod}.`,
      );
      return;
    }
    setShippingSale(s);
  }
  function finishWithShipping(method: V["shippingMethod"]) {
    if (!shippingSale || !method) return;
    set((state: D) => ({
      ...state,
      sales: state.sales.map((sale) =>
        sale.id === shippingSale.id
          ? { ...sale, prepared: true, sent: false, shippingMethod: method }
          : sale,
      ),
    }));
    notify(`Pedido #${orderNo(shippingSale.id)} finalizado para envio por ${method}.`);
    setShippingSale(null);
  }
  function setPreparationStatus(
    s: V,
    preparationStatus: "preparing" | "accumulating" | "waiting",
  ) {
    set((state: D) => ({
      ...state,
      sales: state.sales.map((sale) =>
        sale.id === s.id
          ? {
              ...sale,
              preparationStatus,
              accumulatingDecants: preparationStatus === "accumulating",
            }
          : sale,
      ),
    }));
    notify(
      preparationStatus === "accumulating"
        ? `Pedido #${orderNo(s.id)} marcado para acumular mais decantes.`
        : preparationStatus === "waiting"
          ? `Pedido #${orderNo(s.id)} marcado como Vai esperar.`
          : `Pedido #${orderNo(s.id)} voltou para A preparar.`,
    );
  }
  return (
    <>
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
              onClick={() => (s.prepared ? toggle(s) : prepareSale(s))}
            >
              {s.prepared ? <Check /> : null}
            </button>
            <span>
              <b>{saleCustomer(s, d)}</b>
              {s.items.map((x, i) => (
                <small key={i}>
                  {d.products.find((p) => p.id === x.productId)?.name} — {x.ml}{" "}
                  ml{x.isApc ? " · APC" : ""}
                </small>
              ))}
            </span>
            {saleOriginBadge(s)}
            <span className="prepareActions">
              {s.prepared ? <em>Finalizado</em> : (
                <label className="preparationStatus">
                  <select
                    aria-label={`Situação do pedido #${orderNo(s.id)}`}
                    value={getPreparationStatus(s)}
                    onChange={(event) =>
                      setPreparationStatus(
                        s,
                        event.target.value as
                          | "preparing"
                          | "accumulating"
                          | "waiting",
                      )
                    }
                  >
                    <option value="preparing">A preparar</option>
                    <option value="accumulating">Vai acumular</option>
                    <option value="waiting">Vai esperar</option>
                  </select>
                </label>
              )}
            </span>
          </div>
        ))}
        {!list.length ? <p>Nenhum pedido nesta lista.</p> : null}
      </div>
    </div>
    {shippingSale ? (
      <div className="overlay">
        <div className="systemDialog">
          <header>
            <div><small>FORMA DE ENVIO</small><h2>Como o pedido será enviado?</h2></div>
            <button type="button" onClick={() => setShippingSale(null)}><X /></button>
          </header>
          <p>Pedido #{orderNo(shippingSale.id)} · {saleCustomer(shippingSale, d)}</p>
          <div className="shippingChoices">
            {(["Correios", "Loggi", "Jadlog", "Uber/Pessoalmente"] as const).map((method) => (
              <button type="button" key={method} onClick={() => finishWithShipping(method)}>
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : null}
    </>
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
      !isHistoricalSale(s) &&
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
        ? `Pedido #${orderNo(s.id)} movido para Enviados.`
        : `Pedido #${orderNo(s.id)} voltou para A enviar.`,
    );
  }
  function changeShippingMethod(saleId: number, shippingMethod: V["shippingMethod"]) {
    set((state: D) => ({
      ...state,
      sales: state.sales.map((sale) =>
        sale.id === saleId ? { ...sale, shippingMethod } : sale,
      ),
    }));
    notify("Forma de envio atualizada.");
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
                  <span className="shippingCustomer">
                    <b>
                      Pedido #{orderNo(s.id)} · {saleCustomer(s, d)}
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
                  <strong
                    className={`shippingMethod ${shippingClass(
                      isMarketplaceSale(s) ? s.marketplace : s.shippingMethod,
                    )}`}
                  >
                    {isMarketplaceSale(s)
                      ? s.marketplace || "Marketplace"
                      : s.shippingMethod || "Envio não informado"}
                  </strong>
                  <strong className="deliveryTitle">Informações de entrega</strong>
                </summary>
                <div className="delivery">
                  <label>
                    <span>Forma de envio</span>
                    <select
                      value={isMarketplaceSale(s) ? s.marketplace || "" : s.shippingMethod || ""}
                      disabled={isMarketplaceSale(s)}
                      onChange={(event) =>
                        changeShippingMethod(
                          s.id,
                          event.target.value as V["shippingMethod"],
                        )
                      }
                    >
                      <option value="" disabled>Selecione...</option>
                      <option>Correios</option>
                      <option>Loggi</option>
                      <option>Jadlog</option>
                      <option>Uber/Pessoalmente</option>
                      <option>TikTok Shop</option>
                      <option>Shopee</option>
                    </select>
                  </label>
                  <FieldView label="Nome" value={saleCustomer(s, d)} />
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
                  <FieldView label="Número" value={c?.number} />
                  <FieldView label="Bairro" value={c?.district} />
                  <FieldView
                    label="Cidade / Estado"
                    value={[c?.city, c?.state].filter(Boolean).join(" / ")}
                  />
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
  const [receivableTab, setReceivableTab] = useState<"direct" | "marketplace">(
    "direct",
  );
  const [overdueOnly, setOverdueOnly] = useState(false);
  const allPendingSales = d.sales
    .filter(
      (s) =>
        s.status !== "cancelled" &&
        !isNoCost(s) &&
        (marketplacePending(s) || (!isMarketplaceSale(s) && s.paid < s.total)),
    );
  const pendingSales = allPendingSales.filter(
      (sale) =>
        !overdueOnly ||
        ((sale.installments || []).length
          ? (sale.installments || []).some(
              (installment) =>
                !installment.paid &&
                Boolean(installment.date) &&
                installment.date < today(),
            )
          : Boolean(sale.dueDate) && sale.dueDate! < today()),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const directList = pendingSales.filter((sale) => !isMarketplaceSale(sale));
  const marketplaceList = pendingSales.filter(isMarketplaceSale);
  const list = receivableTab === "marketplace" ? marketplaceList : directList;
  const directTotal = allPendingSales
    .filter((sale) => !isMarketplaceSale(sale))
    .reduce((sum, sale) => sum + amountDue(sale), 0);
  const marketplaceTotal = allPendingSales
    .filter(isMarketplaceSale)
    .reduce((sum, sale) => sum + amountDue(sale), 0);
  function recordPayment(s: V) {
    if (isMarketplaceSale(s)) {
      set((x: D) => ({
        ...x,
        sales: x.sales.map((sale) =>
          sale.id === s.id
            ? { ...sale, marketplacePayoutReceived: true }
            : sale,
        ),
      }));
      notify(`Repasse do pedido #${orderNo(s.id)} confirmado.`);
      return;
    }
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
        ? `Pedido #${orderNo(s.id)} quitado.`
        : `Pagamento de ${brl(amount)} lançado no pedido #${orderNo(s.id)}.`,
    );
  }
  return (
    <>
      <Cards
        v={[
          [brl(directTotal + marketplaceTotal), "Total geral a receber"],
          [brl(directTotal), "Vendas diretas a receber"],
          [brl(marketplaceTotal), "Marketplace a receber"],
          [String(allPendingSales.length), "Total de vendas pendentes"],
        ]}
      />
      <div className="panel table">
        <div className="receivableHeader">
          <div>
            <h2>Vendas a receber</h2>
            <p>Inclui vendas pendentes de qualquer mês.</p>
          </div>
          <div className="receivableTabs" role="tablist" aria-label="Tipo de venda">
            <button
              type="button"
              role="tab"
              aria-selected={receivableTab === "direct"}
              className={receivableTab === "direct" ? "active" : ""}
              onClick={() => setReceivableTab("direct")}
            >
              Vendas diretas <b>{directList.length}</b>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={receivableTab === "marketplace"}
              className={receivableTab === "marketplace" ? "active" : ""}
              onClick={() => setReceivableTab("marketplace")}
            >
              Marketplace <b>{marketplaceList.length}</b>
            </button>
          </div>
          <button
            type="button"
            className={overdueOnly ? "overdueFilter active" : "overdueFilter"}
            onClick={() => setOverdueOnly((current) => !current)}
          >
            <SlidersHorizontal /> {overdueOnly ? "Mostrando vencidas" : "Filtrar vencidas"}
          </button>
        </div>
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
                <td>#{orderNo(s.id)}</td>
                <td>
                  {saleCustomer(s, d)}
                  {isMarketplaceSale(s) ? (
                    <small className="marketplaceReceivableLabel">
                      {s.marketplace || "Marketplace"}
                    </small>
                  ) : null}
                </td>
                <td>{dateBR(s.date)}</td>
                <td>
                  <b>{brl(amountDue(s))}</b>
                </td>
                <td>
                  {s.installments?.length ? (
                    s.installments
                      .filter((p) => !p.paid)
                      .map((p, i) => (
                        <small key={i}>
                          {p.date ? dateBR(p.date) : "Sem data"} — {brl(p.amount)}
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
        {!list.length ? (
          <p className="empty">
            Nenhuma venda pendente nesta categoria.
          </p>
        ) : null}
      </div>
    </>
  );
}

function Stock({
  d,
  add,
  addProduct,
  editSupply,
  edit,
  set,
  notify,
}: {
  d: D;
  add: () => void;
  addProduct: () => void;
  editSupply: (id: number) => void;
  edit: (id: number) => void;
  set: any;
  notify: (s: string) => void;
}) {
  const [view, setView] = useState("perfumes"),
    [category, setCategory] = useState("Todos"),
    [brand, setBrand] = useState("Todas"),
    [query, setQuery] = useState("");
  const brands = Array.from(new Set(d.products.map((p) => p.brand))).sort();
  const perfumeInventoryValue = d.products.reduce(
    (total, product) => total + Math.max(0, product.stock) * product.cost,
    0,
  );
  const filtered = d.products.filter(
    (p) =>
      (view === "out"
        ? p.stock <= 0
        : view === "apc"
          ? p.apc > 0
          : p.stock > 0) &&
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
        <button
          className="primary stockAction"
          onClick={view !== "supplies" ? addProduct : add}
        >
          <Plus />
          {view !== "supplies" ? "Novo perfume" : "Novo suprimento/insumo"}
        </button>
      </div>
      <div className="segmented stockSwitch">
        <button
          className={view !== "supplies" ? "active" : ""}
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
      {view !== "supplies" ? (
        <div className="segmented">
          <button
            className={view === "apc" ? "active" : ""}
            onClick={() => setView("apc")}
          >
            APC's disponíveis ({d.products.filter((p) => p.apc > 0).length})
          </button>
          <button
            className={view === "out" ? "active" : ""}
            onClick={() => setView("out")}
          >
            Perfumes fora de estoque (
            {d.products.filter((p) => p.stock <= 0).length})
          </button>
        </div>
      ) : null}
      {view !== "supplies" ? (
        <>
          <Cards
            v={[
              [String(d.products.length), "Perfumes"],
              [
                d.products.reduce((n, p) => n + p.stock, 0) + " ml",
                "Volume disponível",
              ],
              [brl(perfumeInventoryValue), "Valor em estoque"],
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
          <div className="products">
            {d.supplies.map((s) => (
              <div key={s.id}>
                <h3>{s.name}</h3>
                <p>
                  {s.stock} {s.unit}
                  {s.cost ? ` · ${brl(s.cost)} por unidade` : ""}
                </p>
                {(s.pendingLots || []).length ? (
                  <p className="queuedSupplyLot">
                    Em segundo plano: {(s.pendingLots || []).reduce((sum, lot) => sum + lot.qty, 0)} {s.unit}
                    {s.pendingLots?.[0] ? ` · próximo lote ${brl(s.pendingLots[0].cost)} por unidade` : ""}
                  </p>
                ) : null}
                <p>Custo na venda: {s.attachCost ? "Sim" : "Não"}</p>
                <button className="iconButton" onClick={() => editSupply(s.id)}>
                  <Pencil />
                  Editar
                </button>
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
  edit,
  notify,
}: {
  edit: (id: number) => void;
  d: D;
  set: any;
  notify: (s: string) => void;
}) {
  const [supplierFilter, setSupplierFilter] = useState("Todos");
  const [purchaseQuery, setPurchaseQuery] = useState("");
  const month = today().slice(0, 7),
    monthly = d.purchases.filter((p) => p.date.startsWith(month)),
    spent = monthly.reduce((n, p) => n + p.total, 0);
  const suppliers = Array.from(
    new Set(d.purchases.map((purchase) => purchase.supplier).filter(Boolean)),
  ).sort();
  const filteredPurchases = d.purchases.filter((purchase) => {
    const matchesSupplier =
      supplierFilter === "Todos" || purchase.supplier === supplierFilter;
    const searchable =
      `${purchase.date} ${purchase.supplier} ${purchase.type} ${purchase.description}`.toLowerCase();
    return (
      matchesSupplier && searchable.includes(purchaseQuery.trim().toLowerCase())
    );
  });
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
      supplies: x.supplies.map((supply) => ({
        ...supply,
        pendingLots: (supply.pendingLots || []).filter((lot) => lot.purchaseId !== id),
      })),
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
        <div className="purchaseFilters">
          <label>
            <Search />
            <input
              value={purchaseQuery}
              onChange={(event) => setPurchaseQuery(event.target.value)}
              placeholder="Pesquisar compra, item ou fornecedor"
              aria-label="Pesquisar no histórico de compras"
            />
          </label>
          <select
            value={supplierFilter}
            onChange={(event) => setSupplierFilter(event.target.value)}
            aria-label="Filtrar compras por fornecedor"
          >
            <option>Todos</option>
            {suppliers.map((supplier) => (
              <option key={supplier}>{supplier}</option>
            ))}
          </select>
        </div>
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
            {filteredPurchases.map((p) => (
              <tr key={p.id}>
                <td>{dateBR(p.date)}</td>
                <td>{p.supplier}</td>
                <td>{p.type}</td>
                <td>{p.description}</td>
                <td>
                  {p.qty}
                  {p.mlPerBottle ? ` × ${p.mlPerBottle} ml` : ""}
                </td>
                <td>{brl(p.total)}</td>
                <td>
                  <button className="iconButton" onClick={() => edit(p.id)}>
                    <Pencil />
                    Editar
                  </button>
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
        {!filteredPurchases.length ? (
          <p className="empty">Nenhuma compra encontrada.</p>
        ) : null}
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
  const [query, setQuery] = useState("");
  const clients = d.clients.filter((client) =>
    client.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
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
    <>
      <Cards v={[[String(d.clients.length), "Clientes cadastrados"]]} />
      <div className="clientSearch">
        <Search />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar cliente pelo nome"
          aria-label="Pesquisar cliente pelo nome"
        />
      </div>
      <div className="clients">
        {clients.map((c) => (
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
      {!clients.length ? (
        <p className="empty">Nenhum cliente encontrado.</p>
      ) : null}
    </>
  );
}
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

function PaymentBreakdown({ d }: { d: D }) {
  const payments = [
    { name: "Pix", color: "#22a66f", matches: (sale: V) => !isMarketplaceSale(sale) && ((isInstallmentSale(sale) && isInstallmentSettled(sale)) || (!isInstallmentSale(sale) && sale.payment === "Pix")) },
    { name: "Cartão de Crédito", color: "#2f80ed", matches: (sale: V) => !isMarketplaceSale(sale) && !isInstallmentSale(sale) && sale.payment === "Cartão de Crédito" },
    { name: "À prazo", color: "#e0b43c", matches: (sale: V) => !isMarketplaceSale(sale) && isInstallmentSale(sale) && !isInstallmentSettled(sale) },
    { name: "Marketplace", color: "#8b5cf6", matches: (sale: V) => isMarketplaceSale(sale) },
  ].map((x) => ({
    ...x,
    value: d.sales
      .filter(
        (s) =>
          s.status !== "cancelled" &&
          !isNoCost(s) &&
          !isHistoricalSale(s) &&
          x.matches(s),
      )
      .reduce((n, s) => n + Math.max(0, s.total), 0),
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
        <p>Distribuição do faturamento recebido por forma e origem do pagamento.</p>
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
  const balanceCosts = d.sales
    .filter(
      (sale) =>
        sale.status !== "cancelled" &&
        !isNoCost(sale) &&
        !isHistoricalSale(sale),
    )
    .reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce(
          (itemSum, item) =>
            itemSum +
            item.ml *
              (item.unitCost ??
                d.products.find((product) => product.id === item.productId)?.cost ??
                0),
          0,
        ) +
        Number(sale.expenses || 0) +
        Number(sale.marketplaceFee || 0) +
        Number(sale.shippingCost || 0) +
        packaging(sale, d.supplies).total,
      0,
    );
  const purchaseExpenses = d.purchases.reduce(
    (sum, purchase) => sum + Number(purchase.total || 0),
    0,
  );
  const balance = totals.gross - balanceCosts - purchaseExpenses;
  return (
    <>
      <Cards
        v={[
          [brl(totals.paid), "Faturamento"],
          [brl(totals.gross), "Total vendido"],
          [brl(totals.gross - totals.paid), "A receber"],
          [brl(balance), "Saldo"],
        ]}
      />
      <PaymentBreakdown d={d} />
      <ProfitControl d={d} set={set} notify={notify} />
      <InventoryProjection d={d} />
      <MarketplaceForecast d={d} set={set} notify={notify} />
    </>
  );
}

function InventoryProjection({ d }: { d: D }) {
  const inventoryCost = d.products.reduce(
    (sum, product) => sum + Math.max(0, product.stock) * product.cost,
    0,
  );
  const sales = d.sales.filter(
    (sale) =>
      sale.status !== "cancelled" &&
      !isNoCost(sale) &&
      !isHistoricalSale(sale),
  );
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const costs = sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (itemSum, item) =>
          itemSum +
          item.ml *
            (item.unitCost ??
              d.products.find((product) => product.id === item.productId)?.cost ??
              0),
        0,
      ) +
      Number(sale.expenses || 0) +
      Number(sale.marketplaceFee || 0) +
      Number(sale.shippingCost || 0) +
      packaging(sale, d.supplies).total,
    0,
  );
  const margin = revenue ? Math.max(0, Math.min(0.9, (revenue - costs) / revenue)) : 0;
  const projectedRevenue = margin ? inventoryCost / (1 - margin) : inventoryCost;
  return (
    <div className="panel inventoryProjection">
      <div>
        <span>Valor atual do estoque de perfumes</span>
        <b>{brl(inventoryCost)}</b>
        <small>Custo dos ml ainda disponíveis</small>
      </div>
      <div>
        <span>Projeção de vendas</span>
        <b>{brl(projectedRevenue)}</b>
        <small>Com base na margem média de {(margin * 100).toFixed(1).replace(".", ",")}%</small>
      </div>
      <div>
        <span>Lucro projetado do estoque</span>
        <b>{brl(Math.max(0, projectedRevenue - inventoryCost))}</b>
        <small>Estimativa, antes de novas despesas</small>
      </div>
    </div>
  );
}

function MarketplaceForecast({
  d,
  set,
  notify,
}: {
  d: D;
  set: any;
  notify: (message: string) => void;
}) {
  const terms = d.marketplacePayoutDays || { "TikTok Shop": 9, Shopee: 7 };
  const [editingTerms, setEditingTerms] = useState(false);
  const pending = d.sales
    .filter(
      (sale) =>
        isMarketplaceSale(sale) &&
        sale.status !== "cancelled" &&
        marketplacePending(sale),
    )
    .map((sale) => {
      const platform = sale.marketplace || "Shopee";
      const expected = (() => {
        const date = new Date(`${sale.date}T12:00:00`);
        date.setDate(date.getDate() + terms[platform]);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      })();
      return { sale, platform, expected };
    })
    .sort((a, b) => a.expected.localeCompare(b.expected));
  function saveTerms(event: any) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const next = { Shopee: Number(form.shopee), "TikTok Shop": Number(form.tiktok) };
    if (!Number.isFinite(next.Shopee) || !Number.isFinite(next["TikTok Shop"]) || next.Shopee < 0 || next["TikTok Shop"] < 0) {
      window.alert("Informe prazos válidos em dias.");
      return;
    }
    set((state: D) => ({ ...state, marketplacePayoutDays: next }));
    setEditingTerms(false);
    notify("Prazos de repasse atualizados.");
  }
  return (
    <div className="panel marketplaceForecast">
      <div className="forecastHead">
        <div>
          <h2>Previsão de recebimento de marketplaces</h2>
          <p>Shopee: {terms.Shopee} dias · TikTok Shop: {terms["TikTok Shop"]} dias</p>
        </div>
        <button type="button" className="iconButton" onClick={() => setEditingTerms(true)}>
          <Pencil /> Editar prazos
        </button>
      </div>
      <div className="forecastList">
        {pending.map(({ sale, platform, expected }) => (
          <div key={sale.id}>
            <span>#{orderNo(sale.id)} · {platform}</span>
            <b>{brl(amountDue(sale))}</b>
            <small>Previsão: {dateBR(expected)}</small>
          </div>
        ))}
        {!pending.length ? <p className="empty">Nenhum repasse pendente.</p> : null}
      </div>
      {editingTerms ? (
        <div className="overlay nestedOverlay">
          <form onSubmit={saveTerms}>
            <header>
              <div><small>CONFIGURAÇÃO</small><h2>Editar prazos de repasse</h2></div>
              <button type="button" onClick={() => setEditingTerms(false)}><X /></button>
            </header>
            <Field n="shopee" l="Prazo da Shopee (dias)" t="number" v={terms.Shopee} />
            <Field n="tiktok" l="Prazo do TikTok Shop (dias)" t="number" v={terms["TikTok Shop"]} />
            <footer>
              <button type="button" onClick={() => setEditingTerms(false)}>Cancelar</button>
              <button className="primary">Salvar prazos</button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
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
  const [showOrders, setShowOrders] = useState(false);
  const [editingSale, setEditingSale] = useState<V | null>(null);
  const sales = d.sales.filter(
    (sale) => sale.status !== "cancelled" && !isHistoricalSale(sale),
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
    const expenses =
      Number(sale.expenses || 0) +
      Number(sale.marketplaceFee || 0) +
      Number(sale.shippingCost || 0) +
      packaging(sale, d.supplies).total;
    const profit = (isNoCost(sale) ? 0 : sale.total) - perfumeCost - expenses;
    return { sale, perfumeCost, expenses, profit };
  });
  const revenue = rows.reduce(
    (sum, row) => sum + (isNoCost(row.sale) ? 0 : row.sale.total),
    0,
  );
  const perfumeCost = rows.reduce((sum, row) => sum + row.perfumeCost, 0);
  const expenses = rows.reduce((sum, row) => sum + row.expenses, 0);
  const profit = revenue - perfumeCost - expenses;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  return (
    <>
    <div className="panel profitControl">
      <h2>Margem e despesas por pedido</h2>
      <p>
        Calculado pelo preço vendido, custo por ml do perfume e despesas
        lançadas.
      </p>
      <Cards
        v={[
          [brl(perfumeCost), "Custo dos perfumes"],
          [brl(expenses), "Taxas e despesas"],
          [brl(profit), "Lucro estimado"],
          [`${margin.toFixed(1).replace(".", ",")}%`, "Margem estimada"],
        ]}
      />
      <div className="marginTrack">
        <i style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} />
      </div>
      <button
        type="button"
        className="iconButton profitOrdersToggle"
        onClick={() => setShowOrders((visible) => !visible)}
      >
        {showOrders ? "Ocultar pedidos" : "Ver pedidos"}
      </button>
      {showOrders ? <div className="table">
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
                  <td>#{orderNo(sale.id)}</td>
                  <td>{brl(sale.total)}</td>
                  <td>{brl(cost)}</td>
                  <td>
                    {brl(expense)}
                    <details>
                      <summary>Ver insumos</summary>
                      {packaging(sale, d.supplies).lines.map((line) => (
                        <small key={line.name}>
                          {line.qty} × {line.name}:{" "}
                          {line.missing
                            ? "Custo não cadastrado"
                            : brl(line.total)}
                        </small>
                      ))}
                    </details>
                  </td>
                  <td>{brl(rowProfit)}</td>
                  <td>
                    <button
                      className="iconButton"
                      onClick={() => setEditingSale(sale)}
                    >
                      <Pencil /> Editar despesa
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div> : null}
    </div>
    {editingSale ? (
      <SaleCostEditor
        key={editingSale.id}
        sale={editingSale}
        d={d}
        close={() => setEditingSale(null)}
        save={(updatedSale) => {
          set((state: D) => {
            let supplies = moveSupplyStock(state.supplies, editingSale, 1);
            supplies = moveSupplyStock(supplies, updatedSale, -1);
            return {
              ...state,
              supplies,
              sales: state.sales.map((sale) => sale.id === updatedSale.id ? updatedSale : sale),
            };
          });
          setEditingSale(null);
          notify(`Custos do pedido #${orderNo(updatedSale.id)} atualizados.`);
        }}
      />
    ) : null}
    </>
  );
}

function SaleCostEditor({ sale, d, close, save }: { sale: V; d: D; close: () => void; save: (sale: V) => void }) {
  const supplyOptions = packagingOptions(sale, d.supplies);
  const [extraExpenses, setExtraExpenses] = useState(Number(sale.expenses || 0));
  const [marketplaceFee, setMarketplaceFee] = useState(Number(sale.marketplaceFee || 0));
  const [freightPayer, setFreightPayer] = useState<"client" | "daf">(sale.shippingPaidBy || (sale.shippingCost ? "daf" : "client"));
  const [freightCost, setFreightCost] = useState(Number(sale.shippingCost || 0));
  const [unitCosts, setUnitCosts] = useState(sale.items.map((item) => item.unitCost ?? d.products.find((product) => product.id === item.productId)?.cost ?? 0));
  const [supplyQuantities, setSupplyQuantities] = useState<Record<string, number>>(Object.fromEntries(supplyOptions.map(({ name, automaticQty }) => [name, sale.supplyOverrides?.[name] ?? automaticQty])));
  const previewSale: V = {
    ...sale,
    expenses: extraExpenses,
    marketplaceFee,
    shippingPaidBy: freightPayer,
    shippingCost: freightPayer === "daf" ? freightCost : 0,
    supplyOverrides: supplyQuantities,
    items: sale.items.map((item, index) => ({ ...item, unitCost: Math.max(0, unitCosts[index] || 0) })),
  };
  const perfumeCost = previewSale.items.reduce((sum, item) => sum + item.ml * Number(item.unitCost || 0), 0);
  const supplyCost = packaging(previewSale, d.supplies).total;
  const totalExpenses = extraExpenses + marketplaceFee + Number(previewSale.shippingCost || 0) + supplyCost;
  const profit = previewSale.total - perfumeCost - totalExpenses;
  return (
    <div className="overlay">
      <form className="costEditor" onSubmit={(event) => { event.preventDefault(); save(previewSale); }}>
        <header><div><small>CUSTOS DO PEDIDO #{orderNo(sale.id)}</small><h2>Editar despesas e margem</h2></div><button type="button" onClick={close}><X /></button></header>
        <div className="row">
          <label><span>Despesas extras</span><input type="number" min="0" step="0.01" value={extraExpenses} onChange={(e) => setExtraExpenses(parseDecimal(e.target.value))} /></label>
          <label><span>Taxa do marketplace</span><input type="number" min="0" step="0.01" value={marketplaceFee} onChange={(e) => setMarketplaceFee(parseDecimal(e.target.value))} disabled={!isMarketplaceSale(sale)} /></label>
        </div>
        <Choices label="Frete pago pelo" a={["Cliente", "DAF"]} v={freightPayer === "daf" ? "DAF" : "Cliente"} set={(value) => setFreightPayer(value === "DAF" ? "daf" : "client")} />
        {freightPayer === "daf" ? <label><span>Valor do frete</span><input type="number" min="0" step="0.01" value={freightCost} onChange={(e) => setFreightCost(parseDecimal(e.target.value))} /></label> : null}
        <div className="costEditorSection"><h3>Custo dos perfumes</h3>{sale.items.map((item, index) => <label key={`${item.productId}-${index}`}><span>{d.products.find((product) => product.id === item.productId)?.name || `Perfume ${index + 1}`} — {item.ml} ml · custo por ml</span><input type="number" min="0" step="0.01" value={unitCosts[index] || 0} onChange={(e) => setUnitCosts((current) => { const next = [...current]; next[index] = parseDecimal(e.target.value); return next; })} /></label>)}</div>
        <div className="costEditorSection"><h3>Insumos e suprimentos</h3>{supplyOptions.map(({ name }) => <label key={name}><span>{name}</span><input type="number" min="0" step="1" value={supplyQuantities[name] || 0} onChange={(e) => setSupplyQuantities((current) => ({ ...current, [name]: Math.max(0, parseDecimal(e.target.value)) }))} /></label>)}</div>
        <div className="costEditorSummary"><span>Perfumes <b>{brl(perfumeCost)}</b></span><span>Insumos <b>{brl(supplyCost)}</b></span><span>Despesas totais <b>{brl(totalExpenses)}</b></span><span>Lucro estimado <b>{brl(profit)}</b></span></div>
        <footer><button type="button" onClick={close}>Cancelar</button><button className="primary">Salvar custos</button></footer>
      </form>
    </div>
  );
}

function PackagingSummary({ d }: { d: D }) {
  const active = d.sales.filter((s) => s.status !== "cancelled");
  const cost = active.reduce((n, s) => n + packaging(s, d.supplies).total, 0);
  const missing = [
    ...new Set(active.flatMap((s) => packaging(s, d.supplies).missing)),
  ];
  const revenue = active.reduce((n, s) => n + (isNoCost(s) ? 0 : s.total), 0);
  const otherCosts = active.reduce(
    (n, s) =>
      n +
      (s.expenses || 0) +
      (s.marketplaceFee || 0) +
      (s.shippingCost || 0) +
      s.items.reduce(
        (sum, i) =>
          sum +
          i.ml *
            (i.unitCost ??
              d.products.find((p) => p.id === i.productId)?.cost ??
              0),
        0,
      ),
    0,
  );
  return (
    <div className="panel">
      <h2>Custos e resultado</h2>
      <Cards
        v={[
          [brl(cost), "Insumos dos pedidos"],
          [brl(revenue - cost - otherCosts), "Lucro estimado"],
          [
            (revenue
              ? ((revenue - cost - otherCosts) / revenue) * 100
              : 0
            ).toFixed(1) + "%",
            "Margem estimada",
          ],
        ]}
      />
      <p>
        Insumos calculados pelos preços unitários atuais e baixados
        automaticamente do estoque em cada pedido.
      </p>
      {missing.length ? (
        <p>Custos incompletos: confira {missing.join(", ")}.</p>
      ) : null}
    </div>
  );
}

function InventoryEdit({
  modal,
  d,
  set,
  close,
}: {
  modal: NonNullable<Modal>;
  d: D;
  set: any;
  close: () => void;
}) {
  const supply =
    modal.type === "supplyEdit"
      ? d.supplies.find((s) => s.id === modal.id)
      : undefined;
  const purchase =
    modal.type === "purchaseEdit"
      ? d.purchases.find((p) => p.id === modal.id)
      : undefined;
  const [error, setError] = useState("");
  function save(e: any) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (supply) {
      const stock = Number(f.stock),
        cost = Number(f.cost);
      if (stock < 0 || cost < 0 || !Number.isFinite(stock + cost)) {
        setError("Informe valores válidos.");
        return;
      }
      set((x: D) => ({
        ...x,
        supplies: x.supplies.map((s) =>
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
        ),
      }));
    } else if (purchase) {
      const qty = Number(f.qty),
        total = Number(f.total),
        ml = purchase.type === "Perfume" ? Number(f.ml) : undefined;
      if (
        qty <= 0 ||
        total < 0 ||
        (ml !== undefined && ml <= 0) ||
        !Number.isFinite(qty + total + (ml || 0))
      ) {
        setError("Quantidade e volume devem ser positivos.");
        return;
      }
      const product = d.products.find(
        (p) =>
          `${p.brand} ${p.name}`.trim().toLowerCase() ===
          purchase.description.trim().toLowerCase(),
      );
      const item = d.supplies.find(
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
      const target = purchase.type === "Perfume" ? product : item;
      if (!target) {
        setError(
          "O item original não foi encontrado no estoque. Restaure o nome original antes de editar esta compra.",
        );
        return;
      }
      const before = purchase.qty * (purchase.mlPerBottle || 1),
        after = qty * (ml || 1),
        delta = after - before;
      if (target.stock + delta < 0) {
        setError(
          "A correção deixaria o estoque negativo. Confira as vendas e a quantidade da compra.",
        );
        return;
      }
      const newCost = total / after;
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
                mlPerBottle: ml,
              }
            : p,
        ),
        products: x.products.map((p) =>
          product && p.id === product.id
            ? { ...p, stock: p.stock + delta, cost: newCost }
            : p,
        ),
        supplies: x.supplies.map((s) =>
          item && purchase.type !== "Perfume" && s.id === item.id
            ? { ...s, stock: s.stock + delta, cost: newCost }
            : s,
        ),
      }));
    }
    close();
  }
  return (
    <div className="overlay">
      <form onSubmit={save}>
        <header>
          <h2>{supply ? "Editar suprimento" : "Editar compra"}</h2>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        {supply ? (
          <>
            <Field n="name" l="Nome" v={supply.name} />
            <Field n="unit" l="Unidade" v={supply.unit} />
            <Field n="stock" l="Estoque atual" t="number" v={supply.stock} />
            <Field
              n="cost"
              l="Preço por unidade (R$)"
              t="number"
              v={supply.cost || 0}
            />
            <Choices
              name="attachCost"
              label="Atrelar custo na venda?"
              a={["Sim", "Não"]}
              v={supply.attachCost ? "Sim" : "Não"}
            />
          </>
        ) : purchase ? (
          <>
            <p>{purchase.description}</p>
            <Field n="date" l="Data" t="date" v={purchase.date} />
            <Field n="supplier" l="Fornecedor" v={purchase.supplier} />
            <Field n="qty" l="Quantidade" t="number" v={purchase.qty} />
            {purchase.type === "Perfume" ? (
              <Field
                n="ml"
                l="ml por frasco"
                t="number"
                v={purchase.mlPerBottle}
              />
            ) : null}
            <Field n="total" l="Total pago" t="number" v={purchase.total} />
            <p>
              A quantidade altera o estoque pela diferença. O preço unitário
              será atualizado para o valor desta compra corrigida.
            </p>
          </>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <footer>
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary">Salvar alterações</button>
        </footer>
      </form>
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
    existingProduct = d.products.find((p) => p.id === modal!.id),
    existingSupplier =
      type === "supplier" && modal!.id !== undefined
        ? d.suppliers[modal!.id]
        : undefined;
  const isOldSale = type === "oldSale";
  const isSale = type === "sale" || type === "marketplace" || isOldSale;
  const isMarketplace =
    type === "marketplace" || existingSale?.channel === "marketplace";
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
  const [pay, setPay] = useState(
      isMarketplace ? "À prazo" : existingSale?.payment || "Pix",
    ),
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
    [supplyCalc, setSupplyCalc] = useState({ qty: 0, total: 0 }),
    [installmentLines, setInstallmentLines] = useState(
      existingInstallments.length || 1,
    ),
    [saleAmounts, setSaleAmounts] = useState({
      total: existingSale?.total || 0,
      paid: existingSale?.paid || 0,
    });
  const [saleVolumes, setSaleVolumes] = useState<number[]>(
    existingSale?.items.map((item) => item.ml) || [],
  );
  const [clientDraft, setClientDraft] = useState({
    name: existingClient?.name || "",
    phone: existingClient?.phone || "",
    cpf: existingClient?.cpf || "",
    cep: existingClient?.cep || "",
    address: existingClient?.addresses[0]?.value || "",
    number: existingClient?.number || "",
    district: existingClient?.district || "",
    city: existingClient?.city || "",
    state: existingClient?.state || "",
    label: existingClient?.addresses[0]?.label || "Principal",
  });
  const [clientLookupMessage, setClientLookupMessage] = useState("");
  const [supplyOverrides, setSupplyOverrides] = useState<
    Record<string, number>
  >(existingSale?.supplyOverrides || {});
  const [shippingPaidBy, setShippingPaidBy] = useState<"Cliente" | "DAF">(
    existingSale?.shippingPaidBy === "daf" || Number(existingSale?.shippingCost || 0) > 0
      ? "DAF"
      : "Cliente",
  );
  function findClientByCpf(value: string) {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length !== 11) return;
    const found = d.clients.find(
      (client) =>
        client.id !== existingClient?.id &&
        client.cpf.replace(/\D/g, "") === cpf,
    );
    if (!found) return;
    setClientDraft({
      name: found.name,
      phone: found.phone,
      cpf: found.cpf,
      cep: found.cep,
      address: found.addresses[0]?.value || "",
      number: found.number || "",
      district: found.district || "",
      city: found.city || "",
      state: found.state || "",
      label: found.addresses[0]?.label || "Principal",
    });
    setClientLookupMessage(`Cliente encontrado: ${found.name}`);
  }
  async function fillAddressFromCep(value: string) {
    const cep = value.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setClientLookupMessage("Consultando CEP...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const address = await response.json();
      if (!response.ok || address.erro) throw new Error("CEP não encontrado");
      setClientDraft((current) => ({
        ...current,
        cep: address.cep || current.cep,
        address: address.logradouro || current.address,
        district: address.bairro || "",
        city: address.localidade || "",
        state: address.uf || "",
      }));
      setClientLookupMessage("Endereço preenchido pelo CEP.");
    } catch {
      setClientLookupMessage("Não foi possível localizar este CEP.");
    }
  }
  function submit(e: any) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (isSale && !isOldSale) {
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
    if (type === "supplier") {
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
              cost: Number(f.total) / (Number(f.stock) || 1),
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
      if (isOldSale) {
        let clientId = Number(f.clientId);
        let clients = x.clients;
        if (newClient) {
          clientId = Date.now();
          const address = String(f.newAddress || "");
          clients = [
            ...clients,
            {
              id: clientId,
              name: String(f.newName),
              phone: String(f.newPhone || ""),
              cpf: String(f.newCpf || ""),
              cep: String(f.newCep || ""),
              number: String(f.newNumber || ""),
              date: String(f.date),
              addresses: address ? [{ label: "Principal", value: address }] : [],
            },
          ];
        }
        const installments = Array.from(
          { length: installmentLines },
          (_, index) => ({
            date: String(f["due" + index] || ""),
            amount: Number(f["installment" + index] || 0),
          }),
        ).filter((installment) => installment.date || installment.amount);
        const sale: V = {
          id: x.sales.reduce((max, current) => Math.max(max, current.id), 0) + 1,
          date: String(f.date),
          clientId,
          items: [],
          total: Number(f.total),
          paid: 0,
          payment: "À prazo",
          description: String(f.description || "Venda antiga"),
          dueDate: installments[0]?.date,
          installment: installments[0]?.amount,
          installments,
          prepared: true,
          sent: true,
          status: "active",
          channel: "direct",
          historical: true,
        };
        return { ...x, clients, sales: [sale, ...x.sales] };
      }
      if (type === "purchase") {
        const supplier = (newSupplier
            ? String(f.newSupplier)
            : String(f.supplier)).trim(),
          qty = Number(f.qty || 1),
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
        } else if (kind === "Suprimento / insumo") {
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
        }
        return {
          ...x,
          products,
          supplies,
          brands,
          purchases: [purchase, ...x.purchases],
          suppliers: x.suppliers.some(
            (name) => name.toLowerCase() === supplier.toLowerCase(),
          )
            ? x.suppliers
            : [...x.suppliers, supplier],
        };
      }
      let clientId = isMarketplace ? 0 : Number(f.clientId),
        clients = x.clients;
      if (newClient && !isMarketplace) {
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
            number: String(f.newNumber || ""),
            district: String(f.newDistrict || ""),
            city: String(f.newCity || ""),
            state: String(f.newState || ""),
            date: String(f.date),
            addresses: address ? [{
              label: "Principal",
              value: address,
              district: String(f.newDistrict || ""),
              city: String(f.newCity || ""),
              state: String(f.newState || ""),
            }] : [],
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
          ml: parseDecimal(f["ml" + i]),
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
        id:
          existingSale?.id ||
          x.sales.reduce((max, current) => Math.max(max, current.id), 0) + 1,
        date: String(f.date),
        clientId,
        customerName: isMarketplace
          ? String(f.marketplaceCustomer || "").trim()
          : undefined,
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
        supplyOverrides,
        channel: isMarketplace ? "marketplace" : "direct",
        marketplace: isMarketplace
          ? (String(f.marketplace) as "TikTok Shop" | "Shopee")
          : undefined,
        marketplaceFee: isMarketplace ? Number(f.marketplaceFee || 0) : 0,
        shippingCost:
          shippingPaidBy === "DAF" ? parseDecimal(f.shippingCost) : 0,
        shippingPaidBy: shippingPaidBy === "DAF" ? "daf" : "client",
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
      let supplies = x.supplies;
      if (existingSale && existingSale.status !== "cancelled") {
        supplies = moveSupplyStock(supplies, existingSale, 1);
      }
      supplies = moveSupplyStock(supplies, sale, -1);
      return {
        ...x,
        clients,
        sales: existingSale
          ? x.sales.map((v) => (v.id === sale.id ? sale : v))
          : [sale, ...x.sales],
        products,
        supplies,
      };
    });
    close();
  }
  const title = isSale
    ? isOldSale
      ? "Cadastrar venda antiga a receber"
      : existingSale
      ? "Editar venda"
      : isMarketplace
        ? "Lançar venda Marketplace"
        : "Lançar venda"
    : type === "client"
      ? existingClient
        ? "Editar cliente"
        : "Cadastrar cliente"
      : type === "supplier"
        ? existingSupplier !== undefined
          ? "Editar fornecedor"
          : "Cadastrar fornecedor"
      : type === "product"
        ? existingProduct
          ? "Editar perfume"
          : "Cadastrar perfume"
        : type === "supply"
          ? "Cadastrar suprimento/insumo"
          : "Registrar compra/despesa";
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
        {isOldSale ? (
          <>
            <label className="check">
              <input
                type="checkbox"
                onChange={(event) => setNewClient(event.target.checked)}
              />
              Cadastrar cliente nesta venda
            </label>
            {newClient ? (
              <>
                <div className="row three">
                  <Field n="newName" l="Nome" />
                  <Field n="newPhone" l="WhatsApp (opcional)" required={false} />
                  <Field n="newCpf" l="CPF (opcional)" required={false} />
                </div>
                <div className="row">
                  <Field n="newAddress" l="Endereço (opcional)" required={false} />
                  <Field n="newNumber" l="Número (opcional)" required={false} />
                  <Field n="newCep" l="CEP (opcional)" required={false} />
                </div>
              </>
            ) : (
              <Select n="clientId" l="Cliente" o={d.clients.map((client) => [client.id, client.name])} />
            )}
            <div className="row">
              <Field n="date" l="Data da venda antiga" t="date" v={today()} />
              <Field
                n="total"
                l="Valor da venda"
                t="number"
                onChange={(event) =>
                  setSaleAmounts((current) => ({ ...current, total: Number(event.target.value) }))
                }
              />
            </div>
            <Field n="description" l="Do que se trata a venda" />
            <div className="installmentSummary">
              <span>Total a distribuir <b>{brl(saleAmounts.total)}</b></span>
              <span>{installmentLines} parcela(s)</span>
            </div>
            {Array.from({ length: installmentLines }, (_, index) => (
              <div className="row installmentRow" key={index}>
                <Field n={"due" + index} l={`Data da parcela ${index + 1}`} t="date" />
                <Field
                  n={"installment" + index}
                  l={`Valor da parcela ${index + 1}`}
                  t="number"
                  v={(saleAmounts.total / installmentLines).toFixed(2)}
                />
              </div>
            ))}
            <button type="button" className="add" onClick={() => setInstallmentLines((count) => count + 1)}>
              <Plus /> Adicionar nova parcela
            </button>
          </>
        ) : isSale ? (
          <>
            {isMarketplace ? (
              <div className="marketplaceFields">
                <Choices
                  name="marketplace"
                  label="Onde foi feita a venda?"
                  a={["TikTok Shop", "Shopee"]}
                  v={existingSale?.marketplace || "TikTok Shop"}
                />
                <Field
                  n="marketplaceFee"
                  l="Taxa descontada da venda (R$)"
                  t="number"
                  v={existingSale?.marketplaceFee || 0}
                />
              </div>
            ) : null}
            {isMarketplace ? (
              <Field
                n="marketplaceCustomer"
                l="Cliente"
                p="Escreva o nome da pessoa"
                v={existingSale ? saleCustomer(existingSale, d) : ""}
              />
            ) : (
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
                      <label><span>Nome</span><input name="newName" value={clientDraft.name} onChange={(e) => setClientDraft((c) => ({ ...c, name: e.target.value }))} required /></label>
                      <label><span>WhatsApp (opcional)</span><input name="newPhone" value={clientDraft.phone} onChange={(e) => setClientDraft((c) => ({ ...c, phone: e.target.value }))} /></label>
                      <label><span>CPF (opcional)</span><input name="newCpf" value={clientDraft.cpf} onChange={(e) => setClientDraft((c) => ({ ...c, cpf: e.target.value }))} onBlur={(e) => findClientByCpf(e.target.value)} /></label>
                    </div>
                    <div className="row">
                      <label><span>Endereço (opcional)</span><input name="newAddress" value={clientDraft.address} onChange={(e) => setClientDraft((c) => ({ ...c, address: e.target.value }))} /></label>
                      <label><span>CEP (opcional)</span><input name="newCep" value={clientDraft.cep} onChange={(e) => setClientDraft((c) => ({ ...c, cep: e.target.value }))} onBlur={(e) => fillAddressFromCep(e.target.value)} /></label>
                      <label><span>Número (opcional)</span><input name="newNumber" value={clientDraft.number} onChange={(e) => setClientDraft((c) => ({ ...c, number: e.target.value }))} /></label>
                    </div>
                    <div className="row three">
                      <label><span>Bairro (opcional)</span><input name="newDistrict" value={clientDraft.district} onChange={(e) => setClientDraft((c) => ({ ...c, district: e.target.value }))} /></label>
                      <label><span>Cidade (opcional)</span><input name="newCity" value={clientDraft.city} onChange={(e) => setClientDraft((c) => ({ ...c, city: e.target.value }))} /></label>
                      <label><span>Estado (opcional)</span><select name="newState" value={clientDraft.state} onChange={(e) => setClientDraft((c) => ({ ...c, state: e.target.value }))}><option value="">Selecione...</option>{BRAZIL_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
                    </div>
                    {clientLookupMessage ? <small className="cepStatus">{clientLookupMessage}</small> : null}
                  </>
                ) : (
                  <Select
                    n="clientId"
                    l="Cliente"
                    value={existingSale?.clientId}
                    o={d.clients.map((c) => [c.id, c.name])}
                  />
                )}
              </>
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
                    decimalOnly
                    v={existingSale?.items[i]?.ml}
                    onChange={(event) =>
                      setSaleVolumes((current) => {
                        const next = [...current];
                        next[i] = parseDecimal(event.target.value);
                        return next;
                      })
                    }
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
            <SaleSupplyPicker
              items={Array.from({ length: lines }, (_, index) => ({
                ml: saleVolumes[index] || 0,
                isApc: Boolean(apcLines[index]),
              }))}
              supplies={d.supplies}
              overrides={supplyOverrides}
              setOverrides={setSupplyOverrides}
            />
            <div className="shippingCostBox">
              <Choices
                label="Frete pago pelo"
                a={["Cliente", "DAF"]}
                v={shippingPaidBy}
                set={(value) => setShippingPaidBy(value as "Cliente" | "DAF")}
              />
              {shippingPaidBy === "DAF" ? (
                <Field n="shippingCost" l="Valor do frete (R$)" t="number" v={existingSale?.shippingCost || 0} />
              ) : null}
            </div>
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
            {isMarketplace ? (
              <div className="fixedPayment">
                <span>Forma de pagamento</span>
                <b>À prazo</b>
              </div>
            ) : (
              <Choices
                label="Forma de pagamento"
                a={["Pix", "Cartão de Crédito", "À prazo", "Outro"]}
                v={pay}
                set={setPay}
              />
            )}
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
            <div className="row three">
              <Field
                n="stock"
                l="Quantidade"
                t="number"
                onChange={(e) =>
                  setSupplyCalc((current) => ({
                    ...current,
                    qty: Number(e.target.value),
                  }))
                }
              />
              <Field n="unit" l="Unidade" p="un., caixas..." />
              <Field
                n="total"
                l="Valor pago"
                t="number"
                onChange={(e) =>
                  setSupplyCalc((current) => ({
                    ...current,
                    total: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="calculated">
              Preço pago por unidade
              <b>{brl(supplyCalc.total / (supplyCalc.qty || 1))}</b>
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
              a={["Perfume", "Suprimento / insumo", "Outro"]}
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
            ) : kind === "Suprimento / insumo" ? (
              <>
                <label>
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
                </label>
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
            ) : (
              <>
                <Field n="description" l="Especifique a compra/despesa" />
                <Field n="total" l="Valor total" t="number" />
                <input type="hidden" name="qty" value="1" />
              </>
            )}
          </>
        ) : null}
        {type === "client" ? (
          <>
            <div className="row">
              <label>
                <span>Nome completo</span>
                <input
                  name="name"
                  value={clientDraft.name}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <Field
                n="date"
                l="Data do cadastro"
                t="date"
                v={existingClient?.date || today()}
              />
            </div>
            <div className="row">
              <label>
                <span>Telefone/WhatsApp</span>
                <input
                  name="phone"
                  value={clientDraft.phone}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, phone: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>CPF</span>
                <input
                  name="cpf"
                  value={clientDraft.cpf}
                  onChange={(event) => {
                    setClientDraft((current) => ({ ...current, cpf: event.target.value }));
                    setClientLookupMessage("");
                  }}
                  onBlur={(event) => findClientByCpf(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="addressLookup">
              <label>
                <span>CEP</span>
                <input
                  name="cep"
                  value={clientDraft.cep}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, cep: event.target.value }))
                  }
                  onBlur={(event) => fillAddressFromCep(event.target.value)}
                  required
                />
              </label>
              <button
                type="button"
                className="iconButton"
                onClick={() => fillAddressFromCep(clientDraft.cep)}
              >
                Buscar CEP
              </button>
            </div>
            <div className="addressRow clientAddressRow">
              <label>
                <span>Endereço</span>
                <input
                  name="address0"
                  value={clientDraft.address}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, address: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Número</span>
                <input
                  name="number"
                  value={clientDraft.number}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, number: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Identificação</span>
                <input
                  name="label0"
                  value={clientDraft.label}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder="Casa, trabalho..."
                />
              </label>
            </div>
            <div className="row three">
              <label>
                <span>Bairro</span>
                <input name="district" value={clientDraft.district} onChange={(event) => setClientDraft((current) => ({ ...current, district: event.target.value }))} />
              </label>
              <label>
                <span>Cidade</span>
                <input name="city" value={clientDraft.city} onChange={(event) => setClientDraft((current) => ({ ...current, city: event.target.value }))} />
              </label>
              <label>
                <span>Estado</span>
                <input name="state" value={clientDraft.state} onChange={(event) => setClientDraft((current) => ({ ...current, state: event.target.value }))} />
              </label>
            </div>
            {clientLookupMessage ? <p className="lookupMessage">{clientLookupMessage}</p> : null}
            {Array.from({ length: Math.max(0, addressCount - 1) }, (_, offset) => {
              const i = offset + 1;
              return (
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
                <span />
              </div>
              );
            })}
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
        {type === "supplier" ? (
          <Field
            n="name"
            l="Nome do fornecedor"
            v={existingSupplier || ""}
          />
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

function SaleSupplyPicker({
  items,
  supplies,
  overrides,
  setOverrides,
}: {
  items: { ml: number; isApc?: boolean }[];
  supplies: S[];
  overrides: Record<string, number>;
  setOverrides: (value: Record<string, number>) => void;
}) {
  const options = packagingOptions({ items }, supplies);
  const automatic = Object.fromEntries(
    options.map(({ name, automaticQty }) => [name, automaticQty]),
  ) as Record<string, number>;
  const effectiveSale = { items, supplyOverrides: overrides };
  const effectiveLines = packaging(effectiveSale, supplies).lines;
  const total = effectiveLines.reduce((sum, line) => sum + line.total, 0);

  function update(name: string, qty: number) {
    setOverrides({ ...overrides, [name]: Math.max(0, qty) });
  }

  return (
    <div className="saleSupplies">
      <div className="saleSuppliesHead">
        <div>
          <b>Insumos/suprimentos contabilizados</b>
          <small>
            Quantidades pré-calculadas pelo pedido. Você pode alterar
            manualmente.
          </small>
        </div>
        {Object.keys(overrides).length ? (
          <button type="button" onClick={() => setOverrides({})}>
            Restaurar automático
          </button>
        ) : null}
      </div>
      <div className="saleSupplyList">
        {options.map(({ name, automaticQty }) => {
          const qty = overrides[name] ?? automaticQty;
          const line = effectiveLines.find((item) => item.name === name);
          return (
            <div key={name} className={qty > 0 ? "selected" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={qty > 0}
                  onChange={(event) =>
                    update(
                      name,
                      event.target.checked ? automaticQty || 1 : 0,
                    )
                  }
                />
                <span>{name}</span>
              </label>
              <label>
                <span>Quantidade</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={qty}
                  onChange={(event) => update(name, Number(event.target.value))}
                />
              </label>
              <small>
                {line?.missing ? "Custo não cadastrado" : brl(line?.total || 0)}
              </small>
            </div>
          );
        })}
      </div>
      <strong>Total dos insumos: {brl(total)}</strong>
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
  number: String(f.number || ""),
  district: String(f.district || ""),
  city: String(f.city || ""),
  state: String(f.state || ""),
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
  decimalOnly = false,
}: {
  n: string;
  l: string;
  t?: string;
  v?: string | number;
  p?: string;
  required?: boolean;
  onChange?: (e: any) => void;
  decimalOnly?: boolean;
}) {
  return (
    <label>
      <span>{l}</span>
      <input
        name={n}
        type={decimalOnly ? "text" : t}
        inputMode={decimalOnly ? "decimal" : undefined}
        pattern={decimalOnly ? "[0-9]+([,.][0-9]+)?" : undefined}
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
