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
  ListFilter,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Printer,
} from "lucide-react";
import { automaticPackaging, packaging, PACKAGING_RULES } from "./packaging";
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
};
type C = {
  id: number;
  name: string;
  phone: string;
  cpf: string;
  cep: string;
  date: string;
  addresses: {
    label: string;
    value: string;
    number?: string;
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
  shippingCost?: number;
  shippingPaidBy?: "client" | "daf";
  shippingMethod?: "Correios" | "Loggi" | "Jadlog" | "Uber/Pessoalmente";
  historicalReceivable?: boolean;
  preparationTracked?: boolean;
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
function sameRecord(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function mergeChangedRecords<T extends { id: number }>(
  baseline: T[],
  local: T[],
  remote: T[],
  preserveIdConflicts = false,
) {
  const baselineById = new Map(baseline.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  const result = new Map(remote.map((item) => [item.id, item]));
  let nextId = Math.max(0, ...remote.map((item) => item.id));

  for (const item of baseline) {
    const changed = localById.get(item.id);
    if (!changed) result.delete(item.id);
    else if (!sameRecord(item, changed)) result.set(item.id, changed);
  }
  for (const item of local) {
    if (baselineById.has(item.id)) continue;
    const conflict = result.get(item.id);
    if (preserveIdConflicts && conflict && !sameRecord(conflict, item)) {
      result.set(++nextId, { ...item, id: nextId });
    } else {
      result.set(item.id, item);
    }
  }
  return Array.from(result.values());
}
function mergeChangedStrings(
  baseline: string[],
  local: string[],
  remote: string[],
) {
  const removed = new Set(baseline.filter((item) => !local.includes(item)));
  return Array.from(
    new Set([
      ...remote.filter((item) => !removed.has(item)),
      ...local.filter((item) => !baseline.includes(item)),
    ]),
  );
}
function mergeDataChanges(baseline: D, local: D, remote: D): D {
  return normalizeData({
    ...remote,
    products: mergeChangedRecords(
      baseline.products,
      local.products,
      remote.products,
    ),
    supplies: mergeChangedRecords(
      baseline.supplies,
      local.supplies,
      remote.supplies,
    ),
    clients: mergeChangedRecords(
      baseline.clients,
      local.clients,
      remote.clients,
    ),
    sales: mergeChangedRecords(
      baseline.sales,
      local.sales,
      remote.sales,
      true,
    ),
    purchases: mergeChangedRecords(
      baseline.purchases,
      local.purchases,
      remote.purchases,
    ),
    suppliers: mergeChangedStrings(
      baseline.suppliers,
      local.suppliers,
      remote.suppliers,
    ),
    brands: mergeChangedStrings(
      baseline.brands,
      local.brands,
      remote.brands,
    ),
  });
}
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const parseDecimal = (value: unknown) =>
  Number(String(value ?? "").trim().replace(",", ".")) || 0;
const splitMoney = (total: number, count: number) => {
  if (count <= 0) return [];
  const cents = Math.max(0, Math.round(total * 100));
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from(
    { length: count },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100,
  );
};
const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const orderNo = (id: number) => String(id).padStart(5, "0");
const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
  "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
  "RR", "SC", "SP", "SE", "TO",
];
const shippingClass = (method?: string) =>
  (method || "Não informado")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const supplyStockKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function moveSupplyStock(supplies: S[], sale: V, direction: -1 | 1) {
  if (sale.historicalReceivable) return supplies;
  const usage = packaging(sale, supplies).lines;
  return supplies.map((supply) => {
    const line = usage.find(
      (item) => supplyStockKey(item.name) === supplyStockKey(supply.name),
    );
    return line
      ? { ...supply, stock: Math.max(0, supply.stock + direction * line.qty) }
      : supply;
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
  const [data, setDataState] = useState<D>(() => readLocal()),
    [ready, setReady] = useState(false),
    [sync, setSync] = useState<"loading" | "saved" | "error">("loading");
  const dataRef = useRef(data);
  const lastSyncedRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const [page, setPage] = useState("dashboard"),
    [modal, setModal] = useState<Modal>(null),
    [history, setHistory] = useState(0),
    [toast, setToast] = useState("");
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }
  function setData(update: D | ((current: D) => D)) {
    setDataState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      dataRef.current = next;
      localStorage.setItem("daf-v4", JSON.stringify(next));
      localStorage.setItem("daf-v4-pending", "1");
      return next;
    });
  }
  function retryPendingSave() {
    if (
      localStorage.getItem("daf-v4-pending") === "1" &&
      !saveInFlightRef.current
    ) {
      setDataState((current) => ({ ...current }));
    }
  }
  useEffect(() => {
    let active = true;
    (async () => {
      const local = readLocal();
      const hasPendingLocalChanges =
        localStorage.getItem("daf-v4-pending") === "1";
      const { data: remote, error } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        dataRef.current = local;
        setDataState(local);
        setReady(true);
        setSync("error");
        return;
      }
      const remoteData =
        remote?.data && Object.keys(remote.data).length
          ? normalizeData(remote.data)
          : null;
      let storedBaseline: D | null = null;
      try {
        const rawBaseline = localStorage.getItem("daf-v4-baseline");
        storedBaseline = rawBaseline
          ? normalizeData(JSON.parse(rawBaseline))
          : null;
      } catch {
        storedBaseline = null;
      }
      const chosen = hasPendingLocalChanges
        ? remoteData && storedBaseline
          ? mergeDataChanges(storedBaseline, local, remoteData)
          : local
        : remoteData || local;
      if (hasPendingLocalChanges || !remoteData) {
        const { error: saveError } = await supabase
          .from("app_state")
          .upsert({ user_id: session.user.id, data: chosen });
        if (saveError) {
          dataRef.current = chosen;
          setDataState(chosen);
          setReady(true);
          setSync("error");
          return;
        }
        localStorage.removeItem("daf-v4-pending");
      }
      const serialized = JSON.stringify(chosen);
      dataRef.current = chosen;
      lastSyncedRef.current = serialized;
      localStorage.setItem("daf-v4", serialized);
      localStorage.setItem("daf-v4-baseline", serialized);
      setDataState(chosen);
      setReady(true);
      setSync("saved");
    })();
    return () => {
      active = false;
    };
  }, [session.user.id]);
  useEffect(() => {
    dataRef.current = data;
    const serialized = JSON.stringify(data);
    localStorage.setItem("daf-v4", serialized);
    if (!ready) return;
    if (serialized === lastSyncedRef.current) return;
    const revision = ++saveRevisionRef.current;
    const baseline = lastSyncedRef.current
      ? normalizeData(JSON.parse(lastSyncedRef.current))
      : data;
    localStorage.setItem("daf-v4-pending", "1");
    setSync("loading");
    saveInFlightRef.current = true;
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      const { data: latestRow, error: readError } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (readError) {
        if (revision === saveRevisionRef.current) {
          setSync("error");
          notify("Não foi possível salvar. O sistema tentará novamente.");
        }
        return;
      }
      const payload = latestRow?.data
        ? mergeDataChanges(baseline, data, normalizeData(latestRow.data))
        : data;
      const { error } = await supabase
        .from("app_state")
        .upsert({ user_id: session.user.id, data: payload });
      if (error) {
        if (revision === saveRevisionRef.current) {
          setSync("error");
          notify("Não foi possível salvar. O sistema tentará novamente.");
        }
        return;
      }
      if (revision === saveRevisionRef.current) {
        const saved = JSON.stringify(payload);
        lastSyncedRef.current = saved;
        dataRef.current = payload;
        localStorage.setItem("daf-v4", saved);
        localStorage.setItem("daf-v4-baseline", saved);
        localStorage.removeItem("daf-v4-pending");
        setDataState(payload);
        setSync("saved");
      }
    }).catch(() => {
      if (revision === saveRevisionRef.current) {
        setSync("error");
        notify("Não foi possível salvar. O sistema tentará novamente.");
      }
    }).finally(() => {
      saveInFlightRef.current = false;
    });
  }, [data, ready, session.user.id]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    async function refreshFromCloud() {
      if (
        !active ||
        document.hidden ||
        localStorage.getItem("daf-v4-pending") === "1"
      )
        return;
      const { data: remote, error } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active || error || !remote?.data) return;
      const incoming = normalizeData(remote.data);
      const serialized = JSON.stringify(incoming);
      if (serialized === lastSyncedRef.current) return;
      lastSyncedRef.current = serialized;
      dataRef.current = incoming;
      localStorage.setItem("daf-v4", serialized);
      localStorage.setItem("daf-v4-baseline", serialized);
      setDataState(incoming);
      setSync("saved");
    }
    function handleFocus() {
      if (localStorage.getItem("daf-v4-pending") === "1") {
        retryPendingSave();
      } else {
        void refreshFromCloud();
      }
    }
    const interval = window.setInterval(handleFocus, 5000);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", retryPendingSave);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", retryPendingSave);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [ready, session.user.id]);
  const totals = useMemo(
    () => {
      const active = data.sales.filter(
        (s) => s.status !== "cancelled" && !isNoCost(s),
      );
      const currentMonth = today().slice(0, 7);
      const currentSales = active.filter(
        (s) => !s.historicalReceivable && s.date.startsWith(currentMonth),
      );
      return {
        gross: currentSales.reduce((sum, sale) => sum + sale.total, 0),
        paid: currentSales.reduce((sum, sale) => sum + sale.paid, 0),
        receivable: currentSales.reduce(
          (sum, sale) => sum + Math.max(0, sale.total - sale.paid),
          0,
        ),
      };
    },
    [data.sales],
  );
  const navAlerts: Record<string, number> = {
    receivables: data.sales.filter(
      (s) =>
        s.status !== "cancelled" &&
        s.channel !== "marketplace" &&
        !isNoCost(s) &&
        s.paid < s.total,
    ).length,
    prepare: data.sales.filter(
      (sale) => sale.status !== "cancelled" && !sale.prepared,
    ).length,
    shipping: data.sales.filter(
      (sale) => sale.status !== "cancelled" && sale.prepared && !sale.sent,
    ).length,
  };
  const action =
    page === "sales"
      ? ["Nova venda", "sale"]
      : page === "purchases"
        ? ["Nova compra/despesa", "purchase"]
        : page === "clients"
          ? ["Novo cliente", "client"]
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
          <div
            className={`headerActions ${
              page === "sales" ? "salesHeaderActions" : ""
            }`}
          >
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
  const clients = (merged.clients || []).map((client: C) => ({
    ...client,
    addresses: (client.addresses || []).map((address) => ({
      ...address,
      district: address.district || "",
      city: address.city || "",
      state: address.state || "",
    })),
  }));
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
      const marketplaceSale = s.channel === "marketplace";
      const linkedCustomer = merged.clients.find(
        (client: C) => client.id === s.clientId,
      );
      return {
        ...s,
        id: needsSequentialIds ? sequentialIds.get(s.id) || s.id : s.id,
        clientId: marketplaceSale ? 0 : s.clientId,
        customerName:
          s.customerName ||
          (marketplaceSale ? linkedCustomer?.name : undefined),
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
        shippingCost: Number(s.shippingCost || 0),
        shippingPaidBy:
          s.shippingPaidBy || (Number(s.shippingCost || 0) > 0 ? "daf" : "client"),
        prepared:
          marketplaceSale && !s.preparationTracked
            ? false
            : Boolean(s.prepared),
        preparationTracked: marketplaceSale ? true : s.preparationTracked,
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
      };
    });
  let normalizedSupplies = (merged.supplies || []).map((s: S) => ({
    ...s,
    attachCost: Boolean(s.attachCost),
  }));
  if (!merged.supplyInventoryVersion) {
    normalizedSales.forEach((sale) => {
      normalizedSupplies = moveSupplyStock(normalizedSupplies, sale, -1);
    });
  }
  return {
    ...merged,
    products,
    orderSequenceVersion: 1,
    supplyInventoryVersion: 1,
    supplies: normalizedSupplies,
    clients,
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

function Dash({
  d,
  totals,
}: {
  d: D;
  totals: { gross: number; paid: number; receivable: number };
}) {
  const activeSales = d.sales.filter(
    (s) =>
      s.status !== "cancelled" &&
      !isNoCost(s) &&
      !s.historicalReceivable,
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
          [brl(totals.receivable), "A receber"],
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
  const gross = sales.reduce((sum, sale) => sum + sale.total, 0);
  const tiktok = sales
    .filter((sale) => sale.marketplace === "TikTok Shop")
    .reduce((sum, sale) => sum + sale.total, 0);
  const shopee = sales
    .filter((sale) => sale.marketplace === "Shopee")
    .reduce((sum, sale) => sum + sale.total, 0);
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
  const [salesQuery, setSalesQuery] = useState("");
  const [showSalesFilters, setShowSalesFilters] = useState(false);
  const [salesDay, setSalesDay] = useState("");
  const [salesOrigin, setSalesOrigin] = useState("Todos");
  const [salesStatus, setSalesStatus] = useState("Todos");
  const currentSalesMonth = today().slice(0, 7);
  const [salesMonth, setSalesMonth] = useState(currentSalesMonth);
  const [salesYear, salesMonthNumber] = salesMonth.split("-").map(Number);
  const salesMonthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(salesYear, salesMonthNumber - 1, 1));
  function changeSalesMonth(offset: number) {
    const date = new Date(salesYear, salesMonthNumber - 1 + offset, 1);
    setSalesMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
    setSalesDay("");
  }
  const normalizedQuery = salesQuery
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const filteredSales = d.sales.filter((sale) => {
    const customer = saleCustomer(sale, d)
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return (
      (!normalizedQuery || customer.includes(normalizedQuery)) &&
      (!salesDay || sale.date === salesDay) &&
      (!salesMonth || sale.date.startsWith(salesMonth)) &&
      (salesOrigin === "Todos" ||
        (salesOrigin === "Marketplace"
          ? sale.channel === "marketplace"
          : sale.channel !== "marketplace")) &&
      (salesStatus === "Todos" || saleStatus(sale) === salesStatus)
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
      {edit ? (
        <div className="salesFilterArea">
          <div className="salesSearchRow">
            <label>
              <Search />
              <input
                value={salesQuery}
                onChange={(event) => setSalesQuery(event.target.value)}
                placeholder="Pesquisar pelo nome do cliente"
                aria-label="Pesquisar vendas pelo nome do cliente"
              />
            </label>
            <div className="salesMonthFilter salesMonthFilterAlways">
              <span>Mês</span>
              <div className="salesMonthPicker">
                <button
                  type="button"
                  onClick={() => changeSalesMonth(-1)}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft />
                </button>
                <b>{salesMonthLabel}</b>
                <button
                  type="button"
                  onClick={() => changeSalesMonth(1)}
                  aria-label="Próximo mês"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
            <button
              type="button"
              className={
                salesDay ||
                salesMonth !== currentSalesMonth ||
                salesOrigin !== "Todos" ||
                salesStatus !== "Todos"
                  ? "active"
                  : ""
              }
              onClick={() => setShowSalesFilters((visible) => !visible)}
              aria-expanded={showSalesFilters}
            >
              <ListFilter />
              Filtrar
            </button>
          </div>
          {showSalesFilters ? (
            <div className="salesDateFilters">
              <label>
                <span>Dia</span>
                <input
                  type="date"
                  value={salesDay}
                  onChange={(event) => {
                    const selectedDay = event.target.value;
                    setSalesDay(selectedDay);
                    if (selectedDay) setSalesMonth(selectedDay.slice(0, 7));
                  }}
                />
              </label>
              <label>
                <span>Origem da venda</span>
                <select
                  value={salesOrigin}
                  onChange={(event) => setSalesOrigin(event.target.value)}
                >
                  <option>Todos</option>
                  <option>Venda direta</option>
                  <option>Marketplace</option>
                </select>
              </label>
              <label>
                <span>Status da venda</span>
                <select
                  value={salesStatus}
                  onChange={(event) => setSalesStatus(event.target.value)}
                >
                  <option>Todos</option>
                  <option>Pago</option>
                  <option>À prazo</option>
                  <option>Marketplace</option>
                  <option>Sem custo</option>
                  <option>Cancelada</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSalesDay("");
                  setSalesMonth(currentSalesMonth);
                  setSalesOrigin("Todos");
                  setSalesStatus("Todos");
                }}
                disabled={
                  !salesDay &&
                  salesMonth === currentSalesMonth &&
                  salesOrigin === "Todos" &&
                  salesStatus === "Todos"
                }
              >
                Limpar filtros
              </button>
            </div>
          ) : null}
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
                <small>{s.date}</small>
                {s.status === "cancelled" ? <em>Cancelada</em> : null}
              </td>
              <td>{saleCustomer(s, d)}</td>
              <td>
                {s.items.length ? (
                  s.items.map((x, i) => (
                    <small key={i}>
                      {d.products.find((p) => p.id === x.productId)?.name} —{" "}
                      {x.ml} ml{x.isApc ? " · APC" : ""}
                    </small>
                  ))
                ) : (
                  <small>{s.paymentNote || "Venda antiga"}</small>
                )}
              </td>
              <td>
                {s.payment}
                {s.dueDate ? (
                  <small>
                    {s.dueDate} · {brl(s.installment || 0)}
                  </small>
                ) : null}
              </td>
              <td>
                {s.channel === "marketplace" ? (
                  <span className="marketplaceBadge">{s.marketplace}</span>
                ) : (
                  "Venda direta"
                )}
                {s.marketplaceFee ? (
                  <small>Taxa: {brl(s.marketplaceFee)}</small>
                ) : null}
              </td>
              <td>
                {brl(s.total)}
                <small>Insumos: {brl(packaging(s, d.supplies).total)}</small>
                {s.shippingCost ? (
                  <small>Frete DAF: {brl(s.shippingCost)}</small>
                ) : null}
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
      {!filteredSales.length ? (
        <p className="empty">Nenhuma venda encontrada com esses filtros.</p>
      ) : null}
    </div>
  );
}
const standardPayments = ["Pix", "Cartão de Crédito", "Dinheiro", "À prazo"];
function isNoCost(s: V) {
  return s.payment === "Outro" || !standardPayments.includes(s.payment);
}
function saleStatus(s: V) {
  return s.status === "cancelled"
    ? "Cancelada"
    : s.channel === "marketplace"
      ? "Marketplace"
      : isNoCost(s)
        ? "Sem custo"
        : s.paid >= s.total
          ? "Pago"
          : "À prazo";
}
function saleBadge(s: V) {
  const label = saleStatus(s);
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
  const [shippingSale, setShippingSale] = useState<V | null>(null);
  const list = d.sales.filter(
    (s) =>
      s.status !== "cancelled" &&
      !s.historicalReceivable &&
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
    notify(
      `Pedido #${orderNo(shippingSale.id)} finalizado para envio por ${method}.`,
    );
    setShippingSale(null);
  }
  function originLabel(sale: V) {
    if (sale.channel !== "marketplace") return "Venda direta";
    return sale.marketplace === "Shopee" ? "Shopee" : "TikTok Shop";
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
              onClick={() => (s.prepared ? toggle(s) : setShippingSale(s))}
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
            <strong
              className={`prepareOrigin ${
                s.channel !== "marketplace"
                  ? "direct"
                  : s.marketplace === "Shopee"
                    ? "shopee"
                    : "tiktok"
              }`}
            >
              {originLabel(s)}
            </strong>
            <em>{s.prepared ? "Finalizado" : "A preparar"}</em>
          </div>
        ))}
        {!list.length ? <p>Nenhum pedido nesta lista.</p> : null}
      </div>
      </div>
      {shippingSale ? (
        <div className="overlay">
          <div className="systemDialog">
            <header>
              <div>
                <small>FORMA DE ENVIO</small>
                <h2>Como o pedido será enviado?</h2>
              </div>
              <button type="button" onClick={() => setShippingSale(null)}>
                <X />
              </button>
            </header>
            <p>
              Pedido #{orderNo(shippingSale.id)} · {saleCustomer(shippingSale, d)}
            </p>
            <div className="shippingChoices">
              {(["Correios", "Loggi", "Jadlog", "Uber/Pessoalmente"] as const).map(
                (method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => finishWithShipping(method)}
                  >
                    {method}
                  </button>
                ),
              )}
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
      !s.historicalReceivable &&
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
  function changeShippingMethod(
    saleId: number,
    shippingMethod: V["shippingMethod"],
  ) {
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
                    className={`shippingMethod ${shippingClass(s.shippingMethod)}`}
                  >
                    {s.shippingMethod || "Envio não informado"}
                  </strong>
                  <strong className="deliveryTitle">Informações de entrega</strong>
                </summary>
                <div className="delivery">
                  <label>
                    <span>Forma de envio</span>
                    <select
                      value={s.shippingMethod || ""}
                      onChange={(event) =>
                        changeShippingMethod(
                          s.id,
                          event.target.value as V["shippingMethod"],
                        )
                      }
                    >
                      <option value="" disabled>
                        Selecione...
                      </option>
                      <option>Correios</option>
                      <option>Loggi</option>
                      <option>Jadlog</option>
                      <option>Uber/Pessoalmente</option>
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
                          {a.value}{a.number ? `, nº ${a.number}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FieldView label="CEP" value={c?.cep} />
                  <FieldView label="Número" value={c?.addresses[0]?.number} />
                  <FieldView label="Bairro" value={c?.addresses[0]?.district} />
                  <FieldView
                    label="Cidade / Estado"
                    value={[c?.addresses[0]?.city, c?.addresses[0]?.state]
                      .filter(Boolean)
                      .join(" / ")}
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
  const [paymentSale, setPaymentSale] = useState<V | null>(null);
  const [receivableView, setReceivableView] = useState<
    "direct" | "marketplace"
  >("direct");
  const pendingSales = d.sales
    .filter((s) => s.status !== "cancelled" && !isNoCost(s) && s.paid < s.total)
    .sort((a, b) => a.date.localeCompare(b.date));
  const directSales = pendingSales.filter(
    (sale) => sale.channel !== "marketplace",
  );
  const marketplaceSales = pendingSales.filter(
    (sale) => sale.channel === "marketplace",
  );
  const list = receivableView === "marketplace" ? marketplaceSales : directSales;
  const directTotal = directSales.reduce(
    (sum, sale) => sum + Math.max(0, sale.total - sale.paid),
    0,
  );
  const marketplaceTotal = marketplaceSales.reduce(
    (sum, sale) => sum + Math.max(0, sale.total - sale.paid),
    0,
  );
  function recordPayment(
    s: V,
    installmentIndex: number | null,
    requested: number,
  ) {
    const balance = Math.max(0, s.total - s.paid);
    const amount = Math.min(balance, roundMoney(requested));
    if (!Number.isFinite(amount) || amount <= 0) return;
    set((x: D) => ({
      ...x,
      sales: x.sales.map((sale) => {
        if (sale.id !== s.id) return sale;
        const paid = Math.min(sale.total, roundMoney(sale.paid + amount));
        const installments = (sale.installments || []).map((installment) => ({
          ...installment,
        }));
        if (installmentIndex !== null && installments[installmentIndex]) {
          let remainingPayment = amount;
          const order = [
            installmentIndex,
            ...installments
              .map((_, index) => index)
              .filter(
                (index) =>
                  index !== installmentIndex && !installments[index].paid,
              ),
          ];
          for (const index of order) {
            if (remainingPayment <= 0.001) break;
            const installment = installments[index];
            if (installment.paid) continue;
            if (remainingPayment + 0.001 >= installment.amount) {
              remainingPayment = roundMoney(
                remainingPayment - installment.amount,
              );
              installment.paid = true;
            } else {
              installment.amount = roundMoney(
                installment.amount - remainingPayment,
              );
              remainingPayment = 0;
            }
          }
        }
        if (paid + 0.001 >= sale.total) {
          installments.forEach((installment) => {
            installment.paid = true;
          });
        }
        const nextInstallment = installments.find(
          (installment) => !installment.paid,
        );
        return {
          ...sale,
          paid,
          installments,
          dueDate: nextInstallment?.date,
          installment: nextInstallment?.amount,
        };
      }),
    }));
    setPaymentSale(null);
    notify(
      amount >= balance
        ? `Pedido #${orderNo(s.id)} quitado.`
        : `Pagamento de ${brl(amount)} lançado no pedido #${orderNo(s.id)}.`,
    );
  }
  return (
    <>
      <div className="segmented receivableTabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={receivableView === "direct"}
          className={receivableView === "direct" ? "active" : ""}
          onClick={() => setReceivableView("direct")}
        >
          Vendas diretas ({directSales.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={receivableView === "marketplace"}
          className={receivableView === "marketplace" ? "active marketplace" : "marketplace"}
          onClick={() => setReceivableView("marketplace")}
        >
          Marketplace ({marketplaceSales.length})
        </button>
      </div>
      <Cards
        v={[
          [brl(directTotal), "Vendas diretas a receber"],
          [brl(marketplaceTotal), "Marketplace a receber"],
          [brl(directTotal + marketplaceTotal), "Total geral a receber"],
          [
            String(list.length),
            receivableView === "marketplace"
              ? "Vendas Marketplace pendentes"
              : "Vendas pendentes",
          ],
        ]}
      />
      <div className="panel table">
        <h2>
          {receivableView === "marketplace"
            ? "Marketplace a receber"
            : "Vendas a receber"}
        </h2>
        <p>
          {receivableView === "marketplace"
            ? "Vendas pendentes do TikTok Shop e da Shopee."
            : "Inclui vendas diretas pendentes de qualquer mês."}
        </p>
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Referente a</th>
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
                <td>{saleCustomer(s, d)}</td>
                <td>
                  {s.channel === "marketplace" ? (
                    <span className="receivableMarketplace">
                      {s.marketplace === "Shopee" ? "Shopee" : "TikTok"}
                    </span>
                  ) : (
                    s.paymentNote ||
                    s.items
                      .map(
                        (item) =>
                          d.products.find(
                            (product) => product.id === item.productId,
                          )?.name,
                      )
                      .filter(Boolean)
                      .join(", ") ||
                    "Não informado"
                  )}
                </td>
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
                      onClick={() => setPaymentSale(s)}
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
            {receivableView === "marketplace"
              ? "Nenhuma venda de Marketplace pendente."
              : "Nenhuma venda direta pendente."}
          </p>
        ) : null}
      </div>
      {paymentSale ? (
        <InstallmentPaymentModal
          key={paymentSale.id}
          sale={paymentSale}
          customer={saleCustomer(paymentSale, d)}
          close={() => setPaymentSale(null)}
          confirm={(installmentIndex, amount) =>
            recordPayment(paymentSale, installmentIndex, amount)
          }
        />
      ) : null}
    </>
  );
}

function InstallmentPaymentModal({
  sale,
  customer,
  close,
  confirm,
}: {
  sale: V;
  customer: string;
  close: () => void;
  confirm: (installmentIndex: number | null, amount: number) => void;
}) {
  const unpaid = (sale.installments || [])
    .map((installment, index) => ({ installment, index }))
    .filter(({ installment }) => !installment.paid);
  const initialIndex = unpaid[0]?.index ?? null;
  const balance = Math.max(0, sale.total - sale.paid);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex);
  const [amount, setAmount] = useState(
    initialIndex === null
      ? balance
      : Math.min(balance, unpaid[0].installment.amount),
  );
  const [error, setError] = useState("");

  function choose(index: number) {
    setSelectedIndex(index);
    setAmount(Math.min(balance, sale.installments?.[index]?.amount || balance));
    setError("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor de pagamento válido.");
      return;
    }
    if (amount > balance + 0.001) {
      setError(`O pagamento não pode ultrapassar o saldo de ${brl(balance)}.`);
      return;
    }
    confirm(selectedIndex, amount);
  }

  return (
    <div className="overlay paymentOverlay">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>BAIXA DE PAGAMENTO</small>
            <h2>Dar baixa em parcela</h2>
          </div>
          <button type="button" onClick={close} aria-label="Fechar">
            <X />
          </button>
        </header>
        <div className="paymentContext">
          <span>
            <small>Cliente</small>
            <b>{customer}</b>
          </span>
          <span>
            <small>Saldo a receber</small>
            <b>{brl(balance)}</b>
          </span>
        </div>
        {unpaid.length ? (
          <fieldset className="installmentChoices">
            <legend>Selecione a parcela que está sendo paga</legend>
            {unpaid.map(({ installment, index }, position) => (
              <label key={index}>
                <input
                  type="radio"
                  name="paymentInstallment"
                  checked={selectedIndex === index}
                  onChange={() => choose(index)}
                />
                <span>
                  <b>Parcela {position + 1}</b>
                  <small>{installment.date || "Sem data"}</small>
                  <strong>{brl(installment.amount)}</strong>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="paymentWithoutSchedule">
            Esta venda não possui parcelas cadastradas. A baixa será aplicada ao
            saldo total.
          </p>
        )}
        <label>
          <span>Valor recebido agora</span>
          <input
            type="number"
            min="0.01"
            max={balance}
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(Number(event.target.value));
              setError("");
            }}
            autoFocus
          />
        </label>
        {error ? <small className="formError">{error}</small> : null}
        <footer>
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary">Confirmar baixa</button>
        </footer>
      </form>
    </div>
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
  const filtered = d.products.filter(
    (p) =>
      (view === "out" ? p.stock <= 0 : p.stock > 0) &&
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
      {view !== "supplies" ? (
        <div className="segmented">
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
    }));
    notify("Registro de compra excluído.");
  }
  return (
    <>
      <Cards
        v={[
          [brl(spent), "Gasto em compras/despesas neste mês"],
          [String(monthly.length), "Registros no mês"],
        ]}
      />
      <div className="panel table">
        <h2>Histórico de compras e despesas</h2>
        <div className="purchaseFilters">
          <label>
            <Search />
            <input
              value={purchaseQuery}
              onChange={(event) => setPurchaseQuery(event.target.value)}
              placeholder="Pesquisar compra, despesa, item ou fornecedor"
              aria-label="Pesquisar no histórico de compras e despesas"
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
                <td>{p.date}</td>
                <td>{p.supplier}</td>
                <td>{p.type}</td>
                <td>{p.description}</td>
                <td>
                  {p.type === "Outro" ? (
                    "—"
                  ) : (
                    <>
                      {p.qty}
                      {p.mlPerBottle ? ` × ${p.mlPerBottle} ml` : ""}
                    </>
                  )}
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
          <p className="empty">Nenhuma compra ou despesa encontrada.</p>
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
function PaymentBreakdown({ d }: { d: D }) {
  function paymentKind(sale: V) {
    if (sale.channel === "marketplace") return "Marketplace";
    if (sale.paid < sale.total) return "À prazo";
    const payment = sale.payment
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (payment.includes("prazo")) return "À prazo";
    if (payment.includes("cartao")) return "Cartão de Crédito";
    return payment === "pix" ? "Pix" : sale.payment;
  }
  const payments = [
    { name: "Pix", color: "#22a66f" },
    { name: "Cartão de Crédito", color: "#2f80ed" },
    { name: "À prazo", color: "#e0b43c" },
    { name: "Marketplace", color: "#8b5cf6" },
  ].map((x) => ({
    ...x,
    value: d.sales
      .filter(
        (s) =>
          s.status !== "cancelled" &&
          !isNoCost(s) &&
          !s.historicalReceivable &&
          paymentKind(s) === x.name,
      )
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
          Distribuição do faturamento entre Pix, cartão, vendas a prazo e
          Marketplace.
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

function FinanceCategoryBreakdown({ d }: { d: D }) {
  const activeSales = d.sales.filter(
    (sale) =>
      sale.status !== "cancelled" &&
      !isNoCost(sale) &&
      !sale.historicalReceivable,
  );
  const categories = ["Nicho", "Árabe", "Designer"].map((category) => ({
    category,
    value: activeSales.reduce(
      (total, sale) =>
        total +
        sale.items
          .filter(
            (item) =>
              d.products.find((product) => product.id === item.productId)
                ?.category === category,
          )
          .reduce((sum, item) => sum + item.ml, 0),
      0,
    ),
  }));
  const total = categories.reduce((sum, item) => sum + item.value, 0);
  const maximum = Math.max(1, ...categories.map((item) => item.value));
  return (
    <div className="panel financeCategoryChart categories">
      <h2>Vendas por categoria</h2>
      <p>Distribuição do volume vendido entre nichos, árabes e designers.</p>
      <div
        className="categoryDonut"
        style={{ background: categoryGradient(categories, total) }}
      />
      <div className="categoryLegend">
        {categories.map((item) => (
          <div
            key={item.category}
            className={item.category
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")}
          >
            <span>
              {item.category}
              <b>{item.value.toLocaleString("pt-BR")} ml</b>
            </span>
            <i>
              <b style={{ width: `${(item.value / maximum) * 100}%` }} />
            </i>
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
  totals: { gross: number; paid: number; receivable: number };
  set: any;
  notify: (message: string) => void;
}) {
  const currentMonth = today().slice(0, 7);
  const monthlyPurchasesAndExpenses = d.purchases
    .filter((purchase) => purchase.date.startsWith(currentMonth))
    .reduce((sum, purchase) => sum + purchase.total, 0);
  const monthlySales = d.sales.filter(
    (sale) =>
      sale.status !== "cancelled" &&
      !sale.historicalReceivable &&
      !isNoCost(sale) &&
      sale.date.startsWith(currentMonth),
  );
  const monthlyPerfumeCost = monthlySales.reduce(
    (total, sale) =>
      total +
      sale.items.reduce(
        (saleTotal, item) =>
          saleTotal +
          item.ml *
            (item.unitCost ??
              d.products.find((product) => product.id === item.productId)
                ?.cost ??
              0),
        0,
      ),
    0,
  );
  const monthlyFeesAndExpenses = monthlySales.reduce(
    (total, sale) =>
      total +
      Number(sale.expenses || 0) +
      Number(sale.marketplaceFee || 0) +
      Number(sale.shippingCost || 0) +
      packaging(sale, d.supplies).total,
    0,
  );
  const balance =
    totals.gross -
    monthlyPerfumeCost -
    monthlyFeesAndExpenses -
    monthlyPurchasesAndExpenses;
  return (
    <>
      <Cards
        v={[
          [brl(totals.gross), "Faturamento"],
          [brl(totals.paid), "Recebido"],
          [brl(totals.receivable), "A receber"],
          [brl(balance), "Saldo"],
        ]}
      />
      <div className="financeChartsGrid">
        <PaymentBreakdown d={d} />
        <FinanceCategoryBreakdown d={d} />
      </div>
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
  const [expanded, setExpanded] = useState(false);
  const [editingSale, setEditingSale] = useState<V | null>(null);
  const sales = d.sales.filter(
    (sale) => sale.status !== "cancelled" && !sale.historicalReceivable,
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
      <div className="profitControlHeader">
        <div>
          <h2>Margem e despesas por pedido</h2>
          <p>
            Calculado pelo preço vendido, custo por ml do perfume e despesas
            lançadas.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Ocultar pedidos" : "Ver pedidos"}
        </button>
      </div>
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
      {expanded ? (
        <div className="profitControlDetails">
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
                          {sale.marketplaceFee ? (
                            <small>
                              Taxa do marketplace: {brl(sale.marketplaceFee)}
                            </small>
                          ) : null}
                          {sale.shippingCost ? (
                            <small>
                              Frete por conta da DAF: {brl(sale.shippingCost)}
                            </small>
                          ) : null}
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
          </div>
        </div>
      ) : null}
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
                sales: state.sales.map((sale) =>
                  sale.id === updatedSale.id ? updatedSale : sale,
                ),
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

function SaleCostEditor({
  sale,
  d,
  close,
  save,
}: {
  sale: V;
  d: D;
  close: () => void;
  save: (sale: V) => void;
}) {
  const automatic = automaticPackaging(sale);
  const [extraExpenses, setExtraExpenses] = useState(Number(sale.expenses || 0));
  const [marketplaceFee, setMarketplaceFee] = useState(
    Number(sale.marketplaceFee || 0),
  );
  const [freightPayer, setFreightPayer] = useState<"client" | "daf">(
    sale.shippingPaidBy || (sale.shippingCost ? "daf" : "client"),
  );
  const [freightCost, setFreightCost] = useState(Number(sale.shippingCost || 0));
  const [unitCosts, setUnitCosts] = useState(
    sale.items.map(
      (item) =>
        item.unitCost ??
        d.products.find((product) => product.id === item.productId)?.cost ??
        0,
    ),
  );
  const [supplyQuantities, setSupplyQuantities] = useState<
    Record<string, number>
  >(
    Object.fromEntries(
      PACKAGING_RULES.map((name) => [
        name,
        sale.supplyOverrides?.[name] ?? automatic[name],
      ]),
    ),
  );
  const previewSale: V = {
    ...sale,
    expenses: extraExpenses,
    marketplaceFee,
    shippingPaidBy: freightPayer,
    shippingCost: freightPayer === "daf" ? freightCost : 0,
    supplyOverrides: supplyQuantities,
    items: sale.items.map((item, index) => ({
      ...item,
      unitCost: Math.max(0, unitCosts[index] || 0),
    })),
  };
  const perfumeCost = previewSale.items.reduce(
    (sum, item) => sum + item.ml * Number(item.unitCost || 0),
    0,
  );
  const supplyCost = packaging(previewSale, d.supplies).total;
  const totalExpenses =
    extraExpenses +
    marketplaceFee +
    previewSale.shippingCost! +
    supplyCost;
  const profit = previewSale.total - perfumeCost - totalExpenses;

  return (
    <div className="overlay">
      <form
        className="costEditor"
        onSubmit={(event) => {
          event.preventDefault();
          save(previewSale);
        }}
      >
        <header>
          <div>
            <small>CUSTOS DO PEDIDO #{orderNo(sale.id)}</small>
            <h2>Editar despesas e margem</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="row">
          <label>
            <span>Despesas extras</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraExpenses}
              onChange={(event) => setExtraExpenses(parseDecimal(event.target.value))}
            />
          </label>
          <label>
            <span>Taxa do marketplace</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={marketplaceFee}
              onChange={(event) => setMarketplaceFee(parseDecimal(event.target.value))}
              disabled={sale.channel !== "marketplace"}
            />
          </label>
        </div>
        <fieldset>
          <legend>Frete pago pelo</legend>
          <label>
            <input
              type="radio"
              name="costFreightPayer"
              checked={freightPayer === "client"}
              onChange={() => setFreightPayer("client")}
            />
            <span>Cliente</span>
          </label>
          <label>
            <input
              type="radio"
              name="costFreightPayer"
              checked={freightPayer === "daf"}
              onChange={() => setFreightPayer("daf")}
            />
            <span>DAF</span>
          </label>
        </fieldset>
        {freightPayer === "daf" ? (
          <label>
            <span>Valor do frete</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={freightCost}
              onChange={(event) => setFreightCost(parseDecimal(event.target.value))}
            />
          </label>
        ) : null}
        <div className="costEditorSection">
          <h3>Custo dos perfumes</h3>
          {sale.items.map((item, index) => (
            <label key={`${item.productId}-${index}`}>
              <span>
                {d.products.find((product) => product.id === item.productId)?.name ||
                  `Perfume ${index + 1}`} — {item.ml} ml · custo por ml
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCosts[index] || 0}
                onChange={(event) =>
                  setUnitCosts((current) => {
                    const next = [...current];
                    next[index] = parseDecimal(event.target.value);
                    return next;
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="costEditorSection">
          <h3>Insumos e suprimentos</h3>
          {PACKAGING_RULES.map((name) => (
            <label key={name}>
              <span>{name}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={supplyQuantities[name] || 0}
                onChange={(event) =>
                  setSupplyQuantities((current) => ({
                    ...current,
                    [name]: Math.max(0, parseDecimal(event.target.value)),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="costEditorSummary">
          <span>Perfumes <b>{brl(perfumeCost)}</b></span>
          <span>Insumos <b>{brl(supplyCost)}</b></span>
          <span>Despesas totais <b>{brl(totalExpenses)}</b></span>
          <span>Lucro estimado <b>{brl(profit)}</b></span>
        </div>
        <footer>
          <button type="button" onClick={close}>Cancelar</button>
          <button className="primary">Salvar custos</button>
        </footer>
      </form>
    </div>
  );
}

function PackagingSummary({ d }: { d: D }) {
  const active = d.sales.filter(
    (s) => s.status !== "cancelled" && !s.historicalReceivable,
  );
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
        Insumos calculados pelos preços unitários atuais, incluindo vendas
        antigas. Não altera retroativamente o saldo físico dos suprimentos.
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
            ? {
                ...s,
                name: String(f.name),
                unit: String(f.unit),
                stock,
                cost,
                attachCost: f.attachCost === "Sim",
              }
            : s,
        ),
      }));
    } else if (purchase) {
      const qty = purchase.type === "Outro" ? 1 : Number(f.qty),
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
      const target = purchase.type === "Perfume" ? product : item;
      if (purchase.type !== "Outro" && !target) {
        setError(
          "O item original não foi encontrado no estoque. Restaure o nome original antes de editar esta compra.",
        );
        return;
      }
      const before = purchase.qty * (purchase.mlPerBottle || 1),
        after = qty * (ml || 1),
        delta = after - before;
      if (target && target.stock + delta < 0) {
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
                description:
                  purchase.type === "Outro"
                    ? String(f.description)
                    : p.description,
                qty,
                total,
                mlPerBottle: ml,
              }
            : p,
        ),
        products: x.products.map((p) =>
          purchase.type !== "Outro" && product && p.id === product.id
            ? { ...p, stock: p.stock + delta, cost: newCost }
            : p,
        ),
        supplies: x.supplies.map((s) =>
          item && purchase.type === "Suprimento / insumo" && s.id === item.id
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
          <h2>{supply ? "Editar suprimento" : "Editar compra/despesa"}</h2>
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
            {purchase.type === "Outro" ? (
              <Field
                n="description"
                l="Descrição da despesa"
                v={purchase.description}
              />
            ) : (
              <p>{purchase.description}</p>
            )}
            <Field n="date" l="Data" t="date" v={purchase.date} />
            <Field n="supplier" l="Fornecedor" v={purchase.supplier} />
            {purchase.type !== "Outro" ? (
              <Field n="qty" l="Quantidade" t="number" v={purchase.qty} />
            ) : null}
            {purchase.type === "Perfume" ? (
              <Field
                n="ml"
                l="ml por frasco"
                t="number"
                v={purchase.mlPerBottle}
              />
            ) : null}
            <Field n="total" l="Total pago" t="number" v={purchase.total} />
            {purchase.type !== "Outro" ? (
              <p>
                A quantidade altera o estoque pela diferença. O preço unitário
                será atualizado para o valor desta compra corrigida.
              </p>
            ) : (
              <p>Este registro não movimenta o estoque.</p>
            )}
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
    existingProduct = d.products.find((p) => p.id === modal!.id);
  const isOldSale =
    type === "oldSale" || Boolean(existingSale?.historicalReceivable);
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
      isMarketplace || isOldSale
        ? "À prazo"
        : existingSale?.payment || "Pix",
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
  const [installmentAmounts, setInstallmentAmounts] = useState<number[]>(
    existingInstallments.length
      ? existingInstallments.map((installment) => installment.amount)
      : [Math.max(0, (existingSale?.total || 0) - (existingSale?.paid || 0))],
  );
  const [installmentDates, setInstallmentDates] = useState<string[]>(
    existingInstallments.length
      ? existingInstallments.map((installment) => installment.date)
      : [""],
  );
  const [installmentPaid, setInstallmentPaid] = useState<boolean[]>(
    existingInstallments.length
      ? existingInstallments.map((installment) => Boolean(installment.paid))
      : [false],
  );
  const [installmentsCustomized, setInstallmentsCustomized] = useState(
    existingInstallments.length > 0,
  );
  const [shippingPaidBy, setShippingPaidBy] = useState<"Cliente" | "DAF">(
    existingSale?.shippingPaidBy === "daf" || Number(existingSale?.shippingCost || 0) > 0
      ? "DAF"
      : "Cliente",
  );
  const [cepStatus, setCepStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function fillAddressFromCep(
    rawCep: string,
    fields: { address: string; district?: string; city?: string; state?: string },
  ) {
    const cep = rawCep.replace(/\D/g, "");
    if (!cep) {
      setCepStatus("");
      return;
    }
    if (cep.length !== 8) {
      setCepStatus("Informe um CEP com 8 números.");
      return;
    }
    setCepStatus("Buscando endereço...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const result = await response.json();
      if (!response.ok || result.erro) throw new Error("CEP não encontrado");
      const address = [result.logradouro, result.complemento]
        .filter(Boolean)
        .join(" - ");
      const setFieldValue = (name: string | undefined, value: string) => {
        if (!name) return;
        const field = formRef.current?.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLSelectElement
          | null;
        if (field) field.value = value;
      };
      setFieldValue(fields.address, address);
      setFieldValue(fields.district, result.bairro || "");
      setFieldValue(fields.city, result.localidade || "");
      setFieldValue(fields.state, result.uf || "");
      setCepStatus("Endereço preenchido. Informe apenas o número da residência.");
    } catch {
      setCepStatus("CEP não encontrado. Você ainda pode preencher manualmente.");
    }
  }
  const outstandingAmount = Math.max(
    0,
    saleAmounts.total - saleAmounts.paid,
  );
  const scheduledAmount = Array.from(
    { length: installmentLines },
    (_, index) => (installmentPaid[index] ? 0 : installmentAmounts[index] || 0),
  ).reduce((total, amount) => total + amount, 0);
  const scheduleDifference = outstandingAmount - scheduledAmount;
  useEffect(() => {
    if (installmentsCustomized) return;
    setInstallmentAmounts(splitMoney(outstandingAmount, installmentLines));
  }, [installmentLines, installmentsCustomized, outstandingAmount]);
  function changeInstallmentAmount(index: number, requestedAmount: number) {
    const amount = Math.min(outstandingAmount, Math.max(0, requestedAmount));
    setInstallmentsCustomized(true);
    setInstallmentAmounts((values) => {
      const next = Array.from(
        { length: installmentLines },
        (_, current) => values[current] || 0,
      );
      next[index] = roundMoney(amount);
      const redistributable = next
        .map((_, current) => current)
        .filter((current) => current !== index && !installmentPaid[current]);
      const portions = splitMoney(
        Math.max(0, outstandingAmount - next[index]),
        redistributable.length,
      );
      redistributable.forEach((current, portionIndex) => {
        next[current] = portions[portionIndex];
      });
      return next;
    });
  }
  const [saleVolumes, setSaleVolumes] = useState<number[]>(
    existingSale?.items.map((item) => item.ml) || [],
  );
  const [removedLines, setRemovedLines] = useState<Set<number>>(new Set());
  const [supplyOverrides, setSupplyOverrides] = useState<
    Record<string, number>
  >(existingSale?.supplyOverrides || {});
  const activeLineIndexes = Array.from({ length: lines }, (_, index) => index).filter(
    (index) => !removedLines.has(index),
  );
  function submit(e: any) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (isSale && !isOldSale) {
      const invalid = activeLineIndexes.map((i) =>
        String(f["mobileProductName" + i] || f["productName" + i] || ""),
      ).find(
        (typed) => !d.products.some((p) => `${p.brand} ${p.name}` === typed),
      );
      if (invalid !== undefined) {
        window.alert(
          invalid
            ? `O perfume “${invalid}” não foi encontrado no estoque. Selecione uma opção da busca.`
            : "Selecione um perfume do estoque.",
        );
        return;
      }
      const apcProducts = activeLineIndexes.map((i) => {
        if (!apcLines[i]) return null;
        const typed = String(
          f["mobileProductName" + i] || f["productName" + i] || "",
        );
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
      if (type === "purchase") {
        const supplier = newSupplier
            ? String(f.newSupplier)
            : String(f.supplier),
          qty = kind === "Outro" ? 1 : Number(f.qty),
          mlPerBottle = kind === "Perfume" ? Number(f.mlPerBottle) : undefined,
          total = Number(f.total),
          brand = newBrand ? String(f.newBrand) : String(f.brand || ""),
          description =
            kind === "Perfume"
              ? `${brand} ${String(f.productName)}`.trim()
              : kind === "Suprimento / insumo"
                ? String(f.description)
                : String(f.otherDescription);
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
            date: String(f.date),
            addresses: address
              ? [
                  {
                    label: "Principal",
                    value: address,
                    number: String(f.newAddressNumber || ""),
                    district: String(f.newDistrict || ""),
                    city: String(f.newCity || ""),
                    state: String(f.newState || ""),
                  },
                ]
              : [],
          },
        ];
      }
      const items = isOldSale
        ? []
        : activeLineIndexes.map((i) => {
            const typed = String(
              f["mobileProductName" + i] || f["productName" + i] || "",
            );
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
              date: installmentDates[i] || "",
              amount: Number(installmentAmounts[i] || 0),
              paid: installmentPaid[i] || false,
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
        paid: isOldSale ? existingSale?.paid || 0 : Number(f.paid),
        payment: isOldSale ? "À prazo" : pay,
        paymentNote: isOldSale
          ? String(f.oldSaleDescription || "")
          : pay === "Outro"
            ? String(f.other)
            : undefined,
        dueDate: installments[0]?.date,
        installment: installments[0]?.amount,
        installments,
        prepared: isOldSale ? true : existingSale?.prepared || false,
        sent: isOldSale ? true : existingSale?.sent || false,
        status: existingSale?.status || "active",
        expenses: existingSale?.expenses || 0,
        supplyOverrides: isOldSale ? {} : supplyOverrides,
        channel: isMarketplace ? "marketplace" : "direct",
        marketplace: isMarketplace
          ? (String(f.marketplace) as "TikTok Shop" | "Shopee")
          : undefined,
        marketplaceFee: isMarketplace ? Number(f.marketplaceFee || 0) : 0,
        shippingCost:
          !isOldSale && shippingPaidBy === "DAF"
            ? Number(f.shippingCost || 0)
            : 0,
        shippingPaidBy: shippingPaidBy === "DAF" ? "daf" : "client",
        historicalReceivable: isOldSale,
        preparationTracked: isMarketplace
          ? true
          : existingSale?.preparationTracked,
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
      if (sale.status !== "cancelled") {
        supplies = moveSupplyStock(supplies, sale, -1);
      }
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
    ? existingSale
      ? isOldSale
        ? "Editar venda antiga"
        : "Editar venda"
      : isOldSale
        ? "Cadastrar venda antiga"
        : isMarketplace
          ? "Lançar venda Marketplace"
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
          : "Registrar compra/despesa";
  return (
    <div className="overlay">
      <form ref={formRef} onSubmit={submit}>
        <header>
          <div>
            <small>{modal!.id ? "EDIÇÃO" : "NOVO REGISTRO"}</small>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        {isSale ? (
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
                      <Field n="newName" l="Nome" />
                      <Field
                        n="newPhone"
                        l="WhatsApp (opcional)"
                        required={false}
                      />
                      <Field n="newCpf" l="CPF (opcional)" required={false} />
                    </div>
                    <div className="row three">
                      <Field
                        n="newAddress"
                        l="Endereço (opcional)"
                        required={false}
                      />
                      <Field
                        n="newAddressNumber"
                        l="Número (opcional)"
                        required={false}
                      />
                      <Field
                        n="newCep"
                        l="CEP (opcional)"
                        required={false}
                        onBlur={(event) =>
                          fillAddressFromCep(event.target.value, {
                            address: "newAddress",
                            district: "newDistrict",
                            city: "newCity",
                            state: "newState",
                          })
                        }
                      />
                    </div>
                    <div className="row three">
                      <Field
                        n="newDistrict"
                        l="Bairro (opcional)"
                        required={false}
                      />
                      <Field
                        n="newCity"
                        l="Cidade (opcional)"
                        required={false}
                      />
                      <label>
                        <span>Estado (opcional)</span>
                        <select name="newState" defaultValue="">
                          <option value="">Selecione...</option>
                          {BRAZIL_STATES.map((state) => (
                            <option key={state}>{state}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {cepStatus ? <small className="cepStatus">{cepStatus}</small> : null}
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
            {!isOldSale ? (
              <>
                {activeLineIndexes.map((i) => (
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
                {activeLineIndexes.length > 1 ? (
                  <button
                    type="button"
                    className="removeSaleItem"
                    onClick={() => {
                      setRemovedLines((current) => new Set(current).add(i));
                      setSaleVolumes((current) => {
                        const next = [...current];
                        next[i] = 0;
                        return next;
                      });
                      setApcLines((current) => {
                        const next = [...current];
                        next[i] = false;
                        return next;
                      });
                    }}
                  >
                    <X /> Remover perfume
                  </button>
                ) : null}
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
                  items={activeLineIndexes.map((index) => ({
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
                    set={(value) =>
                      setShippingPaidBy(value as "Cliente" | "DAF")
                    }
                  />
                  {shippingPaidBy === "DAF" ? (
                    <Field
                      n="shippingCost"
                      l="Valor do frete (R$)"
                      t="number"
                      v={existingSale?.shippingCost || 0}
                    />
                  ) : null}
                  <small>
                    Quando informado, o frete entra nas despesas e reduz o lucro
                    e a margem do pedido.
                  </small>
                </div>
              </>
            ) : (
              <div className="oldSaleNotice">
                Esta venda será registrada somente em vendas a receber, sem
                alterar o estoque de perfumes ou insumos.
              </div>
            )}
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
            {isOldSale ? (
              <Field
                n="oldSaleDescription"
                l="Referente a"
                p="Ex.: venda de decantes realizada anteriormente"
                v={existingSale?.paymentNote}
              />
            ) : (
              <Field
                n="paid"
                l="Valor recebido"
                t="number"
                v={existingSale?.paid}
                onChange={(e) =>
                  setSaleAmounts((v) => ({
                    ...v,
                    paid: Number(e.target.value),
                  }))
                }
              />
            )}
            {isMarketplace || isOldSale ? (
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
                    <b>{brl(outstandingAmount)}</b>
                  </span>
                  <span>
                    Total das {installmentLines} parcela(s):{" "}
                    <b>{brl(scheduledAmount)}</b>
                  </span>
                  <span>
                    {Math.abs(scheduleDifference) < 0.01
                      ? "Valores conferem"
                      : scheduleDifference > 0
                        ? `Falta distribuir ${brl(scheduleDifference)}`
                        : `Excede o restante em ${brl(Math.abs(scheduleDifference))}`}
                  </span>
                </div>
                {Array.from({ length: installmentLines }, (_, i) => (
                  <div className="row installmentRow" key={i}>
                    <label>
                      <span>{`Data da parcela ${i + 1}`}</span>
                      <input
                        name={"due" + i}
                        type="date"
                        required
                        value={installmentDates[i] || ""}
                        onChange={(event) =>
                          setInstallmentDates((dates) => {
                            const next = [...dates];
                            next[i] = event.target.value;
                            return next;
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>{`Valor da parcela ${i + 1}`}</span>
                      <input
                        name={"installment" + i}
                        type="number"
                        step="0.01"
                        min="0"
                        value={installmentAmounts[i] ?? 0}
                        readOnly={installmentPaid[i]}
                        onChange={(event) =>
                          changeInstallmentAmount(
                            i,
                            Number(event.target.value || 0),
                          )
                        }
                      />
                    </label>
                    {installmentLines > 1 ? (
                      <button
                        type="button"
                        className="cancelInstallment"
                        onClick={() => {
                          setInstallmentAmounts(() =>
                            splitMoney(outstandingAmount, installmentLines - 1),
                          );
                          setInstallmentDates((dates) =>
                            dates.filter((_, index) => index !== i),
                          );
                          setInstallmentPaid((states) =>
                            states.filter((_, index) => index !== i),
                          );
                          setInstallmentsCustomized(true);
                          setInstallmentLines((count) => count - 1);
                        }}
                        aria-label={`Cancelar parcela ${i + 1}`}
                      >
                        <X /> Cancelar parcela
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="add"
                  onClick={() => {
                    setInstallmentAmounts(
                      splitMoney(outstandingAmount, installmentLines + 1),
                    );
                    setInstallmentsCustomized(true);
                    setInstallmentDates((dates) => [...dates, ""]);
                    setInstallmentPaid((states) => [...states, false]);
                    setInstallmentLines((n) => n + 1);
                  }}
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
            <Field n="date" l="Data da compra/despesa" t="date" v={today()} />
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
            ) : (
              <>
                <Field
                  n="otherDescription"
                  l="Especifique a compra ou despesa"
                  p="Ex.: anúncio, manutenção, material de escritório..."
                />
                <Field n="total" l="Valor total" t="number" />
                <p className="oldSaleNotice">
                  Este registro será contabilizado como despesa e não criará
                  nenhum item no estoque.
                </p>
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
                  n={"addressNumber" + i}
                  l="Número"
                  v={existingClient?.addresses[i]?.number}
                  required={false}
                />
                <Field
                  n={"district" + i}
                  l="Bairro"
                  v={existingClient?.addresses[i]?.district}
                  required={false}
                />
                <Field
                  n={"city" + i}
                  l="Cidade"
                  v={existingClient?.addresses[i]?.city}
                  required={false}
                />
                <label>
                  <span>Estado</span>
                  <select
                    name={"state" + i}
                    defaultValue={existingClient?.addresses[i]?.state || ""}
                  >
                    <option value="">Selecione...</option>
                    {BRAZIL_STATES.map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                  </select>
                </label>
                <Field
                  n={"label" + i}
                  l="Identificação"
                  p="Casa, trabalho..."
                  v={existingClient?.addresses[i]?.label}
                />
                {i === 0 ? (
                  <Field
                    n="cep"
                    l="CEP"
                    v={existingClient?.cep}
                    onBlur={(event) =>
                      fillAddressFromCep(event.target.value, {
                        address: "address0",
                        district: "district0",
                        city: "city0",
                        state: "state0",
                      })
                    }
                  />
                ) : (
                  <span />
                )}
              </div>
            ))}
            {cepStatus ? <small className="cepStatus">{cepStatus}</small> : null}
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
  const automatic = automaticPackaging({ items });
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
        {PACKAGING_RULES.map((name) => {
          const qty = overrides[name] ?? automatic[name];
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
                      event.target.checked ? automatic[name] || 1 : 0,
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
  date: String(f.date),
  addresses: Array.from({ length: n }, (_, i) => ({
    label: String(f["label" + i] || ""),
    value: String(f["address" + i] || ""),
    number: String(f["addressNumber" + i] || ""),
    district: String(f["district" + i] || ""),
    city: String(f["city" + i] || ""),
    state: String(f["state" + i] || ""),
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
    <label className="productSearch">
      <span>Perfume {index + 1}</span>
      <input
        className="desktopProductSearch"
        name={"productName" + index}
        list={"products" + index}
        defaultValue={selected ? `${selected.brand} ${selected.name}` : ""}
        placeholder="Digite para buscar..."
      />
      <datalist id={"products" + index}>
        {products.map((p) => (
          <option key={p.id} value={`${p.brand} ${p.name}`}>
            {p.stock} ml disponíveis · APC{" "}
            {p.apc ? "disponível" : "indisponível"}
          </option>
        ))}
      </datalist>
      <select
        className="mobileProductSearch"
        name={"mobileProductName" + index}
        defaultValue={selected ? `${selected.brand} ${selected.name}` : ""}
      >
        <option value="" disabled>
          Selecione o perfume...
        </option>
        {products.map((p) => (
          <option key={p.id} value={`${p.brand} ${p.name}`}>
            {p.brand} {p.name} · {p.stock} ml · APC {p.apc ? "sim" : "não"}
          </option>
        ))}
      </select>
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
  onBlur,
  hideNumberControls = false,
  decimalOnly = false,
}: {
  n: string;
  l: string;
  t?: string;
  v?: string | number;
  p?: string;
  required?: boolean;
  onChange?: (e: any) => void;
  onBlur?: (e: any) => void;
  hideNumberControls?: boolean;
  decimalOnly?: boolean;
}) {
  return (
    <label>
      <span>{l}</span>
      <input
        name={n}
        type={decimalOnly ? "text" : t}
        className={hideNumberControls ? "numberWithoutControls" : undefined}
        inputMode={decimalOnly ? "decimal" : undefined}
        pattern={decimalOnly ? "[0-9]+([,.][0-9]+)?" : undefined}
        defaultValue={v}
        placeholder={p}
        required={required}
        step={t === "number" ? "0.01" : undefined}
        onChange={onChange}
        onBlur={onBlur}
        onWheel={
          hideNumberControls
            ? (event) => event.currentTarget.blur()
            : undefined
        }
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
            <b>{a.label}</b> {a.value}{a.number ? `, nº ${a.number}` : ""}
          </p>
        ))}
        <Sales d={{ ...d, sales: d.sales.filter((s) => s.clientId === id) }} />
      </div>
    </div>
  );
}
