import type { CSSProperties } from "react";
import { Award, Download, Lock, Sparkles, Trophy } from "lucide-react";

type AchievementSale = {
  id: number;
  date: string;
  total: number;
  payment: string;
  status?: string;
  historical?: boolean;
  items?: unknown[];
};

type AchievementMetric =
  | "revenue-history"
  | "revenue-month"
  | "orders-history"
  | "orders-month";

type AchievementDefinition = {
  id: string;
  metric: AchievementMetric;
  threshold: number;
  display: string;
  headline: string;
  scope: string;
  accent: "gold" | "blue" | "violet" | "emerald";
};

type AchievementComputed = AchievementDefinition & {
  unlocked: boolean;
  unlockedAt?: string;
  current: number;
  progress: number;
};

const LEGACY_REVENUE: Record<string, number> = {
  "2026-06": 14105,
  "2026-07": 8047.21,
  "2026-08": 13013.03,
};

const STANDARD_PAYMENTS = ["Pix", "Cartão de Crédito", "Dinheiro", "À prazo"];

const DEFINITIONS: AchievementDefinition[] = [
  { id: "rev-h-50", metric: "revenue-history", threshold: 50000, display: "50K", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },
  { id: "rev-h-100", metric: "revenue-history", threshold: 100000, display: "100K", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },
  { id: "rev-h-200", metric: "revenue-history", threshold: 200000, display: "200K", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },
  { id: "rev-h-350", metric: "revenue-history", threshold: 350000, display: "350K", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },
  { id: "rev-h-500", metric: "revenue-history", threshold: 500000, display: "500K", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },
  { id: "rev-h-800", metric: "revenue-history", threshold: 800000, display: "800K", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },
  { id: "rev-h-1000", metric: "revenue-history", threshold: 1000000, display: "1 MILHÃO", headline: "FATURADOS", scope: "Faturamento histórico", accent: "gold" },

  { id: "rev-m-30", metric: "revenue-month", threshold: 30000, display: "30K", headline: "FATURADOS", scope: "Em um único mês", accent: "blue" },
  { id: "rev-m-50", metric: "revenue-month", threshold: 50000, display: "50K", headline: "FATURADOS", scope: "Em um único mês", accent: "blue" },
  { id: "rev-m-100", metric: "revenue-month", threshold: 100000, display: "100K", headline: "FATURADOS", scope: "Em um único mês", accent: "blue" },
  { id: "rev-m-150", metric: "revenue-month", threshold: 150000, display: "150K", headline: "FATURADOS", scope: "Em um único mês", accent: "blue" },
  { id: "rev-m-200", metric: "revenue-month", threshold: 200000, display: "200K", headline: "FATURADOS", scope: "Em um único mês", accent: "blue" },

  { id: "ord-h-500", metric: "orders-history", threshold: 500, display: "500", headline: "PEDIDOS", scope: "Pedidos históricos", accent: "violet" },
  { id: "ord-h-1000", metric: "orders-history", threshold: 1000, display: "1.000", headline: "PEDIDOS", scope: "Pedidos históricos", accent: "violet" },
  { id: "ord-h-2000", metric: "orders-history", threshold: 2000, display: "2.000", headline: "PEDIDOS", scope: "Pedidos históricos", accent: "violet" },
  { id: "ord-h-3500", metric: "orders-history", threshold: 3500, display: "3.500", headline: "PEDIDOS", scope: "Pedidos históricos", accent: "violet" },
  { id: "ord-h-5000", metric: "orders-history", threshold: 5000, display: "5.000", headline: "PEDIDOS", scope: "Pedidos históricos", accent: "violet" },

  { id: "ord-m-100", metric: "orders-month", threshold: 100, display: "100", headline: "PEDIDOS", scope: "Em um único mês", accent: "emerald" },
  { id: "ord-m-150", metric: "orders-month", threshold: 150, display: "150", headline: "PEDIDOS", scope: "Em um único mês", accent: "emerald" },
  { id: "ord-m-300", metric: "orders-month", threshold: 300, display: "300", headline: "PEDIDOS", scope: "Em um único mês", accent: "emerald" },
];

function isValidSale(sale: AchievementSale) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const historical = Boolean(sale.historical) || items.length === 0;
  return (
    sale.status !== "cancelled" &&
    STANDARD_PAYMENTS.includes(String(sale.payment || "")) &&
    !historical
  );
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return monthKeyFromDate(date);
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function revenueByMonth(sales: AchievementSale[]) {
  const current = monthKeyFromDate(new Date());
  const rows: { month: string; revenue: number }[] = [];
  let month = "2026-06";
  while (month <= current && rows.length < 120) {
    const revenue =
      LEGACY_REVENUE[month] ??
      sales
        .filter(
          (sale) =>
            isValidSale(sale) && String(sale.date || "").startsWith(month),
        )
        .reduce((sum, sale) => sum + Math.max(0, Number(sale.total) || 0), 0);
    rows.push({ month, revenue });
    month = shiftMonth(month, 1);
  }
  return rows;
}

function ordersByMonth(sales: AchievementSale[]) {
  const map = new Map<string, number>();
  sales.filter(isValidSale).forEach((sale) => {
    const month = String(sale.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    map.set(month, (map.get(month) || 0) + 1);
  });
  return [...map.entries()]
    .map(([month, orders]) => ({ month, orders }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function computeAchievements(sales: AchievementSale[]): AchievementComputed[] {
  const revenueMonths = revenueByMonth(sales);
  const orderMonths = ordersByMonth(sales);
  const validSales = sales
    .filter(isValidSale)
    .sort(
      (a, b) =>
        String(a.date || "").localeCompare(String(b.date || "")) || a.id - b.id,
    );
  const historicalRevenue = revenueMonths.reduce(
    (sum, row) => sum + row.revenue,
    0,
  );
  const bestRevenueMonth = Math.max(0, ...revenueMonths.map((row) => row.revenue));
  const historicalOrders = validSales.length;
  const bestOrderMonth = Math.max(0, ...orderMonths.map((row) => row.orders));

  return DEFINITIONS.map((definition) => {
    let current = 0;
    let unlockedAt: string | undefined;

    if (definition.metric === "revenue-history") {
      current = historicalRevenue;
      let cumulative = 0;
      for (const row of revenueMonths) {
        cumulative += row.revenue;
        if (cumulative >= definition.threshold) {
          unlockedAt = row.month;
          break;
        }
      }
    } else if (definition.metric === "revenue-month") {
      current = bestRevenueMonth;
      unlockedAt = revenueMonths.find(
        (row) => row.revenue >= definition.threshold,
      )?.month;
    } else if (definition.metric === "orders-history") {
      current = historicalOrders;
      const crossingSale = validSales[definition.threshold - 1];
      unlockedAt = crossingSale ? String(crossingSale.date || "").slice(0, 7) : undefined;
    } else {
      current = bestOrderMonth;
      unlockedAt = orderMonths.find(
        (row) => row.orders >= definition.threshold,
      )?.month;
    }

    return {
      ...definition,
      current,
      unlocked: current >= definition.threshold,
      unlockedAt,
      progress: Math.min(100, (current / definition.threshold) * 100),
    };
  });
}

function progressLabel(achievement: AchievementComputed) {
  if (achievement.metric.startsWith("revenue")) {
    const current = achievement.current.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
    const target = achievement.threshold.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
    return `${current} de ${target}`;
  }
  return `${Math.floor(achievement.current).toLocaleString("pt-BR")} de ${achievement.threshold.toLocaleString("pt-BR")} pedidos`;
}

function accentColors(accent: AchievementDefinition["accent"]) {
  if (accent === "blue") return ["#6f83ff", "#35c6dc"];
  if (accent === "violet") return ["#9b6bff", "#6f83ff"];
  if (accent === "emerald") return ["#35c98b", "#57d7c8"];
  return ["#f0bd3d", "#d79120"];
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

async function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível carregar a logo."));
    });
  }
  return image;
}

async function downloadAchievementPng(
  achievement: AchievementComputed,
  logo: string,
) {
  if (!achievement.unlocked) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 2000;
  const context = canvas.getContext("2d");
  if (!context) return;

  const [accentA, accentB] = accentColors(achievement.accent);
  const background = context.createLinearGradient(0, 0, 1600, 2000);
  background.addColorStop(0, "#080b10");
  background.addColorStop(0.5, "#121821");
  background.addColorStop(1, "#05070a");
  context.fillStyle = background;
  context.fillRect(0, 0, 1600, 2000);

  context.save();
  context.globalAlpha = 0.16;
  context.fillStyle = accentA;
  context.beginPath();
  context.moveTo(0, 250);
  context.lineTo(760, 0);
  context.lineTo(1180, 0);
  context.lineTo(0, 760);
  context.closePath();
  context.fill();
  context.fillStyle = accentB;
  context.beginPath();
  context.moveTo(1600, 510);
  context.lineTo(890, 920);
  context.lineTo(1600, 1170);
  context.closePath();
  context.fill();
  context.restore();

  const frameGradient = context.createLinearGradient(80, 80, 1520, 1920);
  frameGradient.addColorStop(0, accentA);
  frameGradient.addColorStop(0.48, "#f5e0a1");
  frameGradient.addColorStop(1, accentB);
  context.strokeStyle = frameGradient;
  context.lineWidth = 14;
  roundedRect(context, 72, 72, 1456, 1856, 42);
  context.stroke();

  context.strokeStyle = "rgba(255,255,255,.18)";
  context.lineWidth = 2;
  roundedRect(context, 105, 105, 1390, 1790, 28);
  context.stroke();

  try {
    const image = await loadImage(logo);
    const maxWidth = 370;
    const maxHeight = 190;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(
      image,
      (1600 - width) / 2,
      245,
      width,
      height,
    );
  } catch {
    context.fillStyle = "#ffffff";
    context.font = "800 68px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("DAF SPLITS", 800, 350);
  }

  context.textAlign = "center";
  context.fillStyle = accentA;
  context.font = `900 ${achievement.display.length > 6 ? 220 : 300}px Arial, sans-serif`;
  context.fillText(achievement.display, 800, 980);

  context.fillStyle = "#ffffff";
  context.font = "900 96px Arial, sans-serif";
  context.fillText(achievement.headline, 800, 1110);

  context.fillStyle = "rgba(255,255,255,.68)";
  context.font = "600 42px Arial, sans-serif";
  context.fillText(achievement.scope, 800, 1200);

  context.strokeStyle = "rgba(255,255,255,.16)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(360, 1320);
  context.lineTo(1240, 1320);
  context.stroke();

  context.fillStyle = "#ffffff";
  context.font = "800 48px Arial, sans-serif";
  context.fillText("CONQUISTA DAF SPLITS", 800, 1435);

  context.fillStyle = "rgba(255,255,255,.62)";
  context.font = "500 34px Arial, sans-serif";
  context.fillText(
    achievement.unlockedAt
      ? `Alcançada em ${monthLabel(achievement.unlockedAt)}`
      : "Conquista alcançada",
    800,
    1510,
  );

  context.fillStyle = accentB;
  context.font = "900 40px Arial, sans-serif";
  context.fillText("EXPERIÊNCIA • CRESCIMENTO • PERFUMARIA", 800, 1730);

  context.fillStyle = "rgba(255,255,255,.45)";
  context.font = "500 28px Arial, sans-serif";
  context.fillText("DAF SPLITS · BELO HORIZONTE", 800, 1800);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 1),
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DAF-Conquista-${achievement.display.replace(/\s+/g, "-")}-${achievement.headline}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function AchievementsPage({
  sales,
  logo,
}: {
  sales: AchievementSale[];
  logo: string;
}) {
  const achievements = computeAchievements(sales);
  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const groups = [
    ["Faturamento histórico", "revenue-history"],
    ["Faturamento em um único mês", "revenue-month"],
    ["Pedidos históricos", "orders-history"],
    ["Pedidos em um único mês", "orders-month"],
  ] as const;

  return (
    <div className="achievementsWorkspace">
      <section className="panel achievementsHero">
        <div>
          <span className="eyebrow">MARCOS DA DAF</span>
          <h2>Conquistas</h2>
          <p>
            Cada selo registra um marco real da evolução da DAF Splits.
            Conquistas desbloqueadas podem ser baixadas em PNG para impressão.
          </p>
        </div>
        <div className="achievementsHeroScore">
          <Trophy />
          <strong>{unlocked.length}</strong>
          <span>de {achievements.length} desbloqueadas</span>
        </div>
      </section>

      {groups.map(([title, metric]) => {
        const group = achievements.filter(
          (achievement) => achievement.metric === metric,
        );
        return (
          <section className="achievementsSection" key={metric}>
            <header>
              <div>
                <span>{title}</span>
                <small>
                  {group.filter((achievement) => achievement.unlocked).length} de{" "}
                  {group.length} alcançadas
                </small>
              </div>
            </header>
            <div className="achievementGrid">
              {group.map((achievement) => {
                const colors = accentColors(achievement.accent);
                return (
                  <button
                    type="button"
                    key={achievement.id}
                    className={
                      "achievementBadge " +
                      (achievement.unlocked ? "unlocked" : "locked")
                    }
                    style={
                      {
                        "--achievement-a": colors[0],
                        "--achievement-b": colors[1],
                      } as CSSProperties
                    }
                    onClick={() =>
                      achievement.unlocked
                        ? void downloadAchievementPng(achievement, logo)
                        : undefined
                    }
                    aria-label={
                      achievement.unlocked
                        ? `Baixar conquista ${achievement.display} ${achievement.headline}`
                        : `Conquista bloqueada: ${achievement.display} ${achievement.headline}`
                    }
                  >
                    <div className="achievementBadgeTop">
                      <span className="achievementBadgeIcon">
                        {achievement.unlocked ? <Award /> : <Lock />}
                      </span>
                      <span className="achievementBadgeStatus">
                        {achievement.unlocked ? "CONQUISTA" : "BLOQUEADA"}
                      </span>
                    </div>
                    <div className="achievementBadgeCenter">
                      <strong>{achievement.display}</strong>
                      <b>{achievement.headline}</b>
                      <span>{achievement.scope}</span>
                    </div>
                    <div className="achievementBadgeProgress">
                      <i>
                        <em style={{ width: `${achievement.progress}%` }} />
                      </i>
                      <small>
                        {achievement.unlocked
                          ? achievement.unlockedAt
                            ? `Alcançada em ${monthLabel(achievement.unlockedAt)}`
                            : "Conquista alcançada"
                          : progressLabel(achievement)}
                      </small>
                    </div>
                    <div className="achievementBadgeFooter">
                      {achievement.unlocked ? (
                        <>
                          <Download />
                          <span>Clique para baixar o PNG</span>
                        </>
                      ) : (
                        <>
                          <Sparkles />
                          <span>Continue avançando</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
