import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  MessageCircle,
  PackageOpen,
  Upload,
  Trash2,
  Palette,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import { supabase } from "./supabase";
import { PUBLISHED_CATALOG_KEY, readCommittedCatalogCache } from "./crm/fabio-persistence";
import "./catalog.css";

export type CatalogItem = {
  id: number;
  brand: string;
  name: string;
  category: string;
  gender: string;
  stock: number;
  apc: boolean;
  bottle?: number;
  imageUrl?: string;
  fragranticaId?: number;
  fragranticaRating?: number;
  fragranticaRatingCount?: number;
  manualImage?: boolean;
};

export type CatalogSettings = {
  background: string;
  header: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  whatsapp: string;
  whatsappText: string;
  apcAvailable: string;
  apcAvailableText: string;
  apcUnavailable: string;
  apcUnavailableText: string;
  scarcity: string;
  groupBackground: string;
  groupBorder: string;
  groupButton: string;
  groupButtonText: string;
  categoryOrder: string[];
  productOrder: "alphabetical" | "category" | "mostRated";
  manualImages: Record<string, string>;
};

const LEGACY_CATALOG_SETTINGS: CatalogSettings = {
  background: "#080a0e",
  header: "#000000",
  card: "#111111",
  text: "#f6f1e8",
  muted: "#929cab",
  line: "#252c37",
  accent: "#d7aa36",
  whatsapp: "#d7aa36",
  whatsappText: "#100d06",
  apcAvailable: "#2fa974",
  apcAvailableText: "#07110f",
  apcUnavailable: "#ff3545",
  apcUnavailableText: "#ffffff",
  scarcity: "#d7aa36",
  groupBackground: "#0d0d0d",
  groupBorder: "#d7aa36",
  groupButton: "#d7aa36",
  groupButtonText: "#100d06",
  categoryOrder: ["Nicho", "Árabe", "Designer"],
  productOrder: "alphabetical",
  manualImages: {},
};

export const DEFAULT_CATALOG_SETTINGS: CatalogSettings = {
  background: "#010101",
  header: "#010101",
  card: "#0d0d0d",
  text: "#f2efe9",
  muted: "#aaa49a",
  line: "#3b2c18",
  accent: "#c1893b",
  whatsapp: "#c1893b",
  whatsappText: "#010101",
  apcAvailable: "#25d366",
  apcAvailableText: "#010101",
  apcUnavailable: "#ef4444",
  apcUnavailableText: "#fff7f7",
  scarcity: "#c1893b",
  groupBackground: "#050505",
  groupBorder: "#c1893b",
  groupButton: "#c1893b",
  groupButtonText: "#010101",
  categoryOrder: ["Nicho", "Árabe", "Designer"],
  productOrder: "alphabetical",
  manualImages: {},
};

type ProductLike = {
  id: number;
  brand: string;
  name: string;
  category: string;
  gender?: string;
  stock: number;
  apc: number;
  bottle?: number;
};

type CatalogSettingsEnvelope = {
  __catalogSettings: CatalogSettings;
};

const CATALOG_COLOR_KEYS = [
  "background",
  "header",
  "card",
  "text",
  "muted",
  "line",
  "accent",
  "whatsapp",
  "whatsappText",
  "apcAvailable",
  "apcAvailableText",
  "apcUnavailable",
  "apcUnavailableText",
  "scarcity",
  "groupBackground",
  "groupBorder",
  "groupButton",
  "groupButtonText",
] as const;

type CatalogColorKey = (typeof CATALOG_COLOR_KEYS)[number];

const CATALOG_CATEGORIES = ["Nicho", "Árabe", "Designer"] as const;

function normalizeCategoryOrder(value: unknown): string[] {
  const incoming = Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter((item) =>
          CATALOG_CATEGORIES.includes(item as (typeof CATALOG_CATEGORIES)[number]),
        )
    : [];
  return [
    ...Array.from(new Set(incoming)),
    ...CATALOG_CATEGORIES.filter((category) => !incoming.includes(category)),
  ];
}

function normalizeProductOrder(
  value: unknown,
): CatalogSettings["productOrder"] {
  return value === "category" || value === "mostRated"
    ? value
    : "alphabetical";
}

function normalizeManualImages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, image]) => typeof image === "string" && image.trim())
      .map(([key, image]) => [key, String(image).trim()]),
  );
}

function normalizeHex(value: unknown, fallback: string) {
  const normalized = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : fallback;
}

export function normalizeCatalogSettings(value: unknown): CatalogSettings {
  const source =
    value && typeof value === "object"
      ? (value as Partial<CatalogSettings>)
      : {};
  const settings: CatalogSettings = {
    ...DEFAULT_CATALOG_SETTINGS,
    categoryOrder: normalizeCategoryOrder(source.categoryOrder),
    productOrder: normalizeProductOrder(source.productOrder),
    manualImages: normalizeManualImages(source.manualImages),
  };

  CATALOG_COLOR_KEYS.forEach((key: CatalogColorKey) => {
    const incoming = normalizeHex(
      source[key],
      DEFAULT_CATALOG_SETTINGS[key],
    );
    settings[key] =
      incoming === LEGACY_CATALOG_SETTINGS[key]
        ? DEFAULT_CATALOG_SETTINGS[key]
        : incoming;
  });

  return settings;
}

export function catalogSnapshotPayload(
  items: CatalogItem[],
  settings: CatalogSettings,
) {
  return [
    { __catalogSettings: normalizeCatalogSettings(settings) },
    ...items,
  ];
}

function readCatalogSnapshot(value: unknown): {
  items: CatalogItem[];
  settings: CatalogSettings;
} {
  const list = Array.isArray(value) ? value : [];
  const envelope = list.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "__catalogSettings" in (entry as Record<string, unknown>),
  ) as CatalogSettingsEnvelope | undefined;

  const items = list.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "id" in (entry as Record<string, unknown>) &&
      !("__catalogSettings" in (entry as Record<string, unknown>)),
  ) as CatalogItem[];

  return {
    items,
    settings: normalizeCatalogSettings(envelope?.__catalogSettings),
  };
}

function catalogStyle(settings: CatalogSettings): CSSProperties {
  return {
    "--catalog-bg": settings.background,
    "--catalog-header": settings.header,
    "--catalog-panel": settings.card,
    "--catalog-card": settings.card,
    "--catalog-text": settings.text,
    "--catalog-muted": settings.muted,
    "--catalog-line": settings.line,
    "--catalog-gold": settings.accent,
    "--catalog-whatsapp": settings.whatsapp,
    "--catalog-whatsapp-text": settings.whatsappText,
    "--catalog-apc-available": settings.apcAvailable,
    "--catalog-apc-available-text": settings.apcAvailableText,
    "--catalog-apc-unavailable": settings.apcUnavailable,
    "--catalog-apc-unavailable-text": settings.apcUnavailableText,
    "--catalog-scarcity": settings.scarcity,
    "--catalog-group-bg": settings.groupBackground,
    "--catalog-group-border": settings.groupBorder,
    "--catalog-group-button": settings.groupButton,
    "--catalog-group-button-text": settings.groupButtonText,
  } as CSSProperties;
}


const FRAGRANTICA_SOCIAL_CARD_BASE =
  "https://www.fragrantica.com.br/mdimg/perfume-social-cards/pt-p_c_";

function normalizePerfumeName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const FRAGRANTICA_IDS: Array<{
  aliases: string[];
  id: number;
}> = [
  { aliases: ["club de nuit elite"], id: 139792 },
  { aliases: ["odyssey mandarin sky"], id: 83132 },
  { aliases: ["ayat"], id: 123653 },
  { aliases: ["blind ectasy", "blind ecstasy"], id: 126944 },
  { aliases: ["elliur"], id: 123655 },
  { aliases: ["maktub gold"], id: 123657 },
  { aliases: ["sex on the rocks"], id: 140284 },
  { aliases: ["good girl polka paradise"], id: 127509 },
  { aliases: ["allure homme sport"], id: 607 },
  { aliases: ["atlantis extrait"], id: 113595 },
  { aliases: ["ghost spectre", "spectre ghost"], id: 94697 },
  { aliases: ["liquid brun"], id: 94713 },
  { aliases: ["le beau edt", "le beau eau de toilette", "le beau"], id: 55785 },
  { aliases: ["le male le parfum"], id: 61856 },
  { aliases: ["island dreams"], id: 113593 },
  { aliases: ["idole edp", "idole eau de parfum", "idole"], id: 55795 },
  { aliases: ["asad elixir"], id: 117616 },
  { aliases: ["fakhar platin"], id: 107363 },
  { aliases: ["iii thriller", "thriller iii"], id: 123585 },
  { aliases: ["french riviera"], id: 74636 },
  { aliases: ["jasmin exclusif"], id: 74107 },
  { aliases: ["hacivat frasco 3", "hacivat"], id: 44174 },
  { aliases: ["wulong cha x"], id: 80465 },
  { aliases: ["althair"], id: 84109 },
  { aliases: ["hawas kobra"], id: 112706 },
  {
    aliases: [
      "stronger with you powerfully",
      "emporio armani stronger with you powerfully",
    ],
    id: 123070,
  },
  { aliases: ["gold rose oudh"], id: 16522 },
  {
    aliases: [
      "valentino donna yellow dream",
      "valentino donna born in roma yellow dream",
      "donna born in roma yellow dream",
    ],
    id: 64615,
  },
  { aliases: ["erba gold"], id: 76683 },
  { aliases: ["xj 1861 renaissance", "1861 renaissance", "renaissance"], id: 12126 },
  { aliases: ["torino 21", "torino21"], id: 70424 },
  { aliases: ["myslf edp", "myslf eau de parfum", "myslf"], id: 84094 },
  {
    aliases: ["world cup vip", "world cup edition", "world cup"],
    id: 138879,
  },
  // Exemplo ensinado pelo usuário; já fica pronto caso volte ao estoque.
  { aliases: ["vibrato"], id: 75930 },
];

function knownFragranticaId(
  name: string,
  bottle?: number,
): number | undefined {
  const normalized = normalizePerfumeName(name);

  // A versão atual de 100 ml da DAF é Dior Homme Parfum 2025.
  // Mantém compatibilidade com eventual retorno do antigo frasco de 75 ml.
  if (normalized === "dior homme parfum" || normalized === "dior homme parfum 2025") {
    return Number(bottle || 0) === 75 ? 27417 : 101016;
  }

  for (const entry of FRAGRANTICA_IDS) {
    if (
      entry.aliases.some((alias) => {
        const normalizedAlias = normalizePerfumeName(alias);
        return (
          normalized === normalizedAlias ||
          (normalizedAlias.length >= 5 && normalized.includes(normalizedAlias)) ||
          (normalized.length >= 5 && normalizedAlias.includes(normalized))
        );
      })
    ) {
      return entry.id;
    }
  }
  return undefined;
}

function fragranticaSocialCardUrl(id: number) {
  return `${FRAGRANTICA_SOCIAL_CARD_BASE}${id}.jpeg`;
}

function applyKnownFragranticaImage<T extends CatalogItem>(
  item: T,
  bottle?: number,
): T {
  if (item.manualImage && item.imageUrl) return item;
  const id = knownFragranticaId(item.name, bottle);
  if (id) {
    return {
      ...item,
      fragranticaId: id,
      imageUrl: fragranticaSocialCardUrl(id),
    };
  }
  if (item.imageUrl) return item;
  return item;
}

function validFragranticaImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(FRAGRANTICA_SOCIAL_CARD_BASE) &&
    /^https:\/\/www\.fragrantica\.com\.br\/mdimg\/perfume-social-cards\/pt-p_c_\d+\.jpeg$/.test(
      value,
    )
  );
}

export async function enrichCatalogItemsWithImages(
  items: CatalogItem[],
  signal?: AbortSignal,
  includeMetrics = false,
): Promise<CatalogItem[]> {
  return Promise.all(
    items.map(async (item) => {
      // Imagens manuais têm prioridade. Para as automáticas, a resolução remota
      // usa sempre marca + nome antes de recorrer ao mapa local de contingência.
      if (item.manualImage && item.imageUrl && !includeMetrics) return item;

      const cacheKey =
        "daf-fragrantica:" +
        normalizePerfumeName(item.brand + " " + item.name);

      try {
        const cached =
          typeof window !== "undefined"
            ? window.localStorage.getItem(cacheKey)
            : null;
        if (!includeMetrics && validFragranticaImageUrl(cached)) {
          const match = cached.match(/pt-p_c_(\d+)\.jpeg$/);
          return {
            ...item,
            imageUrl: cached,
            fragranticaId: match ? Number(match[1]) : undefined,
          };
        }
      } catch {
        // Cache local indisponível; segue com resolução remota.
      }

      try {
        const params = new URLSearchParams({
          brand: item.brand,
          name: item.name,
        });
        if (item.fragranticaId) {
          params.set("fragranticaId", String(item.fragranticaId));
        }
        const deadline = AbortSignal.timeout(4000);
        const response = await fetch("/api/fragrantica-image?" + params.toString(), {
          signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        });
        if (!response.ok) return applyKnownFragranticaImage(item, item.bottle);
        const data = await response.json();
        const resolvedImage = validFragranticaImageUrl(data?.imageUrl)
          ? data.imageUrl
          : undefined;
        const rating = Number(data?.fragranticaRating);
        const ratingCount = Number(data?.fragranticaRatingCount);
        if (!resolvedImage && !Number.isFinite(ratingCount)) {
          return applyKnownFragranticaImage(item, item.bottle);
        }

        try {
          if (
            typeof window !== "undefined" &&
            resolvedImage &&
            !includeMetrics
          ) {
            window.localStorage.setItem(cacheKey, resolvedImage);
          }
        } catch {
          // Falha de cache não impede o catálogo.
        }

        return {
          ...item,
          imageUrl:
            item.manualImage && item.imageUrl
              ? item.imageUrl
              : resolvedImage || item.imageUrl,
          fragranticaId:
            Number(data.fragranticaId) || item.fragranticaId || undefined,
          fragranticaRating:
            Number.isFinite(rating) && rating > 0
              ? rating
              : item.fragranticaRating,
          fragranticaRatingCount:
            Number.isFinite(ratingCount) && ratingCount >= 0
              ? ratingCount
              : item.fragranticaRatingCount,
        };
      } catch {
        return applyKnownFragranticaImage(item, item.bottle);
      }
    }),
  );
}

export function catalogItemsFromProducts(
  products: ProductLike[],
  manualImages: Record<string, string> = {},
): CatalogItem[] {
  return products
    .map((product) => {
      const item: CatalogItem = {
        id: product.id,
        brand: String(product.brand || "").trim(),
        name: String(product.name || "").trim(),
        category: String(product.category || "Outros").trim(),
        gender: String(product.gender || "Unissex").trim(),
        stock: Math.max(0, Number(product.stock) || 0),
        apc: Number(product.apc || 0) > 0,
        bottle: Math.max(0, Number(product.bottle) || 0) || undefined,
      };
      const manualImage = manualImages[String(product.id)]?.trim();
      if (manualImage) {
        return {
          ...item,
          imageUrl: manualImage,
          manualImage: true,
        };
      }
      return item;
    })
    .filter((item) => item.stock > 0)
    .sort((a, b) =>
      `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, "pt-BR", {
        sensitivity: "base",
      }),
    );
}

function CatalogViewer({
  items,
  settings,
  updatedAt: _updatedAt,
  adminPreview = false,
}: {
  items: CatalogItem[];
  settings: CatalogSettings;
  updatedAt?: string;
  adminPreview?: boolean;
}) {
  const [category, setCategory] = useState("Todos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const categoryOrder = useMemo(() => {
    const configured = normalizeCategoryOrder(settings.categoryOrder);
    const extras = Array.from(
      new Set(items.map((item) => item.category).filter(Boolean)),
    ).filter((item) => !configured.includes(item));
    return [...configured, ...extras];
  }, [items, settings.categoryOrder]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizePerfumeName(query);
    const alpha = (a: CatalogItem, b: CatalogItem) =>
      `${a.brand} ${a.name}`.localeCompare(
        `${b.brand} ${b.name}`,
        "pt-BR",
        { sensitivity: "base" },
      );
    const categoryRank = (value: string) => {
      const index = categoryOrder.indexOf(value);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };

    return items
      .filter((item) => {
        const matchesCategory =
          category === "Todos" || item.category === category;
        const matchesQuery =
          !normalizedQuery ||
          normalizePerfumeName(`${item.brand} ${item.name}`).includes(
            normalizedQuery,
          );
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        if (settings.productOrder === "mostRated") {
          const ratingCountDelta =
            Math.max(0, Number(b.fragranticaRatingCount) || 0) -
            Math.max(0, Number(a.fragranticaRatingCount) || 0);
          if (ratingCountDelta) return ratingCountDelta;
          const ratingDelta =
            Math.max(0, Number(b.fragranticaRating) || 0) -
            Math.max(0, Number(a.fragranticaRating) || 0);
          if (ratingDelta) return ratingDelta;
          return alpha(a, b);
        }
        if (settings.productOrder === "category") {
          const categoryDelta =
            categoryRank(a.category) - categoryRank(b.category);
          if (categoryDelta) return categoryDelta;
        }
        return alpha(a, b);
      });
  }, [items, category, query, categoryOrder, settings.productOrder]);

  return (
    <div
      className={adminPreview ? "catalogExperience embedded" : "catalogExperience"}
      style={catalogStyle(settings)}
    >
      <header className={"catalogHeader" + (headerScrolled ? " scrolled" : "")}>
        <div className="catalogHeaderInner">
          <img
            src="/icon-512.png"
            alt="DAF Splits"
            className="catalogHeaderLogo"
          />
        </div>
      </header>

      <main className="catalogMain">
        {adminPreview ? (
          <div className="catalogPreviewNotice">
            <PackageOpen />
            <div>
              <strong>Prévia administrativa</strong>
              <span>Esta visualização usa diretamente o estoque atual do sistema.</span>
            </div>
          </div>
        ) : null}

        <section className="catalogReferenceIntro">
          <h1>Perfumes disponíveis</h1>

          <div
            className={"catalogReferenceFilters" + (searchOpen ? " searchOpen" : "")}
            aria-label="Filtrar catálogo"
          >
            <div className="catalogSearchControl">
              <button
                type="button"
                className={"catalogSearchToggle" + (searchOpen ? " active" : "")}
                onClick={() => {
                  setSearchOpen((open) => {
                    if (open) setQuery("");
                    return !open;
                  });
                }}
                aria-label={searchOpen ? "Fechar pesquisa" : "Pesquisar perfume"}
                title="Pesquisar perfume"
              >
                <Search />
              </button>
              {searchOpen ? (
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar perfume ou marca..."
                  aria-label="Pesquisar perfume ou marca"
                />
              ) : null}
            </div>

            {["Todos", ...categoryOrder].map((option) => (
              <button
                type="button"
                key={option}
                className={category === option ? "active" : ""}
                onClick={() => setCategory(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {filtered.length ? (
          <section className="catalogGrid">
            {filtered.map((item) => (
              <article className="catalogCard" key={item.id}>
                <div className="catalogMediaBlock">
                  <div className={item.apc ? "catalogApcBanner yes" : "catalogApcBanner no"}>
                    <span />
                    <strong>
                      {item.apc
                        ? "APC Disponível"
                        : "Sem APC no momento, mas ainda temos decantes disponíveis"}
                    </strong>
                  </div>

                  <div className="catalogBottleVisual">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={`${item.brand} ${item.name}`}
                        className="catalogPerfumeImage"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const fallback = event.currentTarget
                            .nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="catalogBottleFallback"
                      style={{ display: item.imageUrl ? "none" : "flex" }}
                      aria-hidden="true"
                    >
                      <div className="catalogBottleCap" />
                      <div className="catalogBottleBody">
                        <span>{item.brand.slice(0, 1).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="catalogCardContent">
                  <div className="catalogCardIdentity">
                    <span className="catalogCardBrand">{item.brand}</span>
                    <h3>{item.name}</h3>
                  </div>

                  <div className="catalogScarcity">
                    <div className="catalogScarcityText">
                      <span>Restam {item.stock.toLocaleString("pt-BR")} ml</span>
                    </div>
                    <div className="catalogScarcityTrack" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.max(
                            item.stock > 0 ? 6 : 0,
                            Math.min(
                              100,
                              item.bottle && item.bottle > 0
                                ? (item.stock / item.bottle) * 100
                                : Math.min(100, item.stock),
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <a
                    className="catalogWhatsappButton"
                    href={`https://wa.me/5531975359963?text=${encodeURIComponent(
                      `Olá! Gostaria de solicitar MLs do perfume ${item.name} da marca ${item.brand}. Ainda está disponível?!`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle />
                    <span>Solicitar via WhatsApp</span>
                  </a>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="catalogEmpty">
            <PackageOpen />
            <h3>Nenhum perfume encontrado</h3>
            <p>Altere a categoria ou a pesquisa para visualizar outros perfumes.</p>
          </div>
        )}

        <section className="catalogGroupCta">
          <div className="catalogGroupCtaCopy">
            <span>COMUNIDADE DAF</span>
            <h2>Ainda não faz parte do nosso grupo exclusivo?</h2>
            <p>
              Entre para acompanhar novidades, reposições e oportunidades da DAF Splits.
            </p>
          </div>
          <div className="catalogGroupArrow" aria-hidden="true">
            <ArrowDown />
          </div>
          <a
            href="https://chat.whatsapp.com/CJmt4Dzmln3EuOJoCi0Tkq"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle />
            Entrar no grupo exclusivo
          </a>
        </section>
      </main>
    </div>
  );
}

function CatalogColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="catalogColorField">
      <span>{label}</span>
      <div>
        <input
          type="color"
          value={normalizeHex(value, "#000000")}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Selecionar cor de ${label}`}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(normalizeHex(value, "#000000"))}
          spellCheck={false}
          aria-label={`Código hexadecimal de ${label}`}
        />
      </div>
    </label>
  );
}

async function catalogFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1200;
      const scale = Math.min(
        1,
        maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(original);
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/webp", 0.82));
      } catch {
        resolve(original);
      }
    };
    image.onerror = () => resolve(original);
    image.src = original;
  });
}

export function CatalogAdminPreview({
  products,
  settings,
  onSettingsChange,
}: {
  products: ProductLike[];
  settings: CatalogSettings;
  onSettingsChange: (settings: CatalogSettings) => void;
}) {
  const normalizedSettings = useMemo(
    () => normalizeCatalogSettings(settings),
    [settings],
  );
  const baseItems = useMemo(
    () => catalogItemsFromProducts(products, normalizedSettings.manualImages),
    [products, normalizedSettings.manualImages],
  );
  const [previewItems, setPreviewItems] = useState(baseItems);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogSettings>(normalizedSettings);
  const [imageEditorError, setImageEditorError] = useState("");

  useEffect(() => {
    let active = true;
    setPreviewItems(baseItems);
    enrichCatalogItemsWithImages(
      baseItems,
      undefined,
      normalizedSettings.productOrder === "mostRated",
    ).then((resolved) => {
      if (active) setPreviewItems(resolved);
    });
    return () => {
      active = false;
    };
  }, [baseItems]);

  useEffect(() => {
    if (!editorOpen && !imageEditorOpen) setDraft(normalizedSettings);
  }, [normalizedSettings, editorOpen, imageEditorOpen]);

  const updateDraft = (key: CatalogColorKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  function setManualImage(productId: number, value: string) {
    setDraft((current) => ({
      ...current,
      manualImages: {
        ...current.manualImages,
        [String(productId)]: value.trim(),
      },
    }));
  }

  function removeManualImage(productId: number) {
    setDraft((current) => {
      const manualImages = { ...current.manualImages };
      delete manualImages[String(productId)];
      return { ...current, manualImages };
    });
  }


  function moveCategory(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const next = [...normalizeCategoryOrder(current.categoryOrder)];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, categoryOrder: next };
    });
  }

  const editorSections: Array<{
    title: string;
    description: string;
    fields: Array<[CatalogColorKey, string]>;
  }> = [
    {
      title: "Estrutura",
      description: "Fundo, header, cards, textos e contornos do catálogo.",
      fields: [
        ["background", "Fundo do catálogo"],
        ["header", "Header"],
        ["card", "Cards dos perfumes"],
        ["line", "Bordas e divisórias"],
        ["text", "Texto principal"],
        ["muted", "Texto secundário"],
      ],
    },
    {
      title: "Filtros e destaques",
      description: "Cor usada no filtro ativo, lupa e detalhes de destaque.",
      fields: [["accent", "Filtro ativo e destaques"]],
    },
    {
      title: "APC e estoque",
      description: "Status de APC e indicador visual dos ml restantes.",
      fields: [
        ["apcAvailable", "APC disponível"],
        ["apcAvailableText", "Texto do APC disponível"],
        ["apcUnavailable", "Sem APC"],
        ["apcUnavailableText", "Texto do aviso sem APC"],
        ["scarcity", "Barra de escassez"],
      ],
    },
    {
      title: "Solicitação via WhatsApp",
      description: "Botão presente em cada perfume.",
      fields: [
        ["whatsapp", "Botão do WhatsApp"],
        ["whatsappText", "Texto do botão"],
      ],
    },
    {
      title: "Comunidade DAF",
      description: "Bloco final que convida o visitante para o grupo exclusivo.",
      fields: [
        ["groupBackground", "Fundo do bloco"],
        ["groupBorder", "Borda do bloco"],
        ["groupButton", "Botão do grupo"],
        ["groupButtonText", "Texto do botão do grupo"],
      ],
    },
  ];

  return (
    <div className="catalogAdminArea">
      <div className="catalogAdminToolbar">
        <div>
          <span>Personalização</span>
          <strong>Visual do catálogo público</strong>
        </div>
        <button
          type="button"
          className="catalogEditButton"
          onClick={() => {
            setDraft(normalizedSettings);
            setEditorOpen(true);
          }}
        >
          <Palette />
          Editar
        </button>
      </div>

      <CatalogViewer
        items={previewItems}
        settings={normalizedSettings}
        updatedAt={new Date().toISOString()}
        adminPreview
      />

      {editorOpen ? (
        <div className="catalogEditorOverlay">
          <div className="catalogEditorDialog">
            <header>
              <div>
                <span>EDITOR DO CATÁLOGO</span>
                <h2>Personalizar catálogo atual</h2>
                <p>
                  Ajuste os elementos que existem hoje no catálogo público e
                  acompanhe a prévia antes de salvar.
                </p>
              </div>
              <button
                type="button"
                className="catalogEditorClose"
                onClick={() => setEditorOpen(false)}
                aria-label="Fechar editor"
              >
                <X />
              </button>
            </header>

            <div
              className="catalogEditorPreview catalogEditorPreviewCurrent"
              style={catalogStyle(normalizeCatalogSettings(draft))}
            >
              <div className="catalogEditorMiniHeader">
                <img src="/icon-512.png" alt="" />
              </div>

              <div className="catalogEditorMiniFilter">
                <Search />
                <span>Todos</span>
                {normalizeCategoryOrder(draft.categoryOrder).map(
                  (categoryName, index) =>
                    index === normalizeCategoryOrder(draft.categoryOrder).length - 1 ? (
                      <strong key={categoryName}>{categoryName}</strong>
                    ) : (
                      <span key={categoryName}>{categoryName}</span>
                    ),
                )}
              </div>

              <div className="catalogEditorPreviewCard current">
                <div className="catalogEditorApc available">APC Disponível</div>
                <div className="catalogEditorImagePlaceholder">
                  <ImageIcon />
                </div>
                <span className="catalogEditorBrand">Bidaya</span>
                <strong>Maktub Gold</strong>
                <i><em /></i>
                <button type="button">Solicitar via WhatsApp</button>
              </div>

              <div className="catalogEditorPreviewCard current unavailableCard">
                <div className="catalogEditorApc unavailable">
                  Sem APC no momento, mas ainda temos decantes disponíveis
                </div>
                <span className="catalogEditorBrand">DAF Splits</span>
                <strong>Prévia do aviso sem APC</strong>
              </div>

              <div className="catalogEditorMiniGroup">
                <span>COMUNIDADE DAF</span>
                <strong>Ainda não faz parte do nosso grupo exclusivo?</strong>
                <ArrowDown />
                <button type="button">Entrar no grupo exclusivo</button>
              </div>
            </div>

            <section className="catalogEditorOrdering">
              <header>
                <div>
                  <strong>Organização do catálogo</strong>
                  <span>
                    Defina a ordem dos filtros e como os perfumes serão exibidos.
                  </span>
                </div>
              </header>

              <div className="catalogOrderingGrid">
                <div className="catalogCategoryOrder">
                  <span>Ordem das categorias</span>
                  {normalizeCategoryOrder(draft.categoryOrder).map(
                    (categoryName, index, list) => (
                      <div key={categoryName}>
                        <b>{categoryName}</b>
                        <div>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveCategory(index, -1)}
                            aria-label={`Mover ${categoryName} para cima`}
                          >
                            <ArrowUp />
                          </button>
                          <button
                            type="button"
                            disabled={index === list.length - 1}
                            onClick={() => moveCategory(index, 1)}
                            aria-label={`Mover ${categoryName} para baixo`}
                          >
                            <ArrowDown />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="catalogProductOrder">
                  <span>Ordem dos perfumes</span>
                  {[
                    ["alphabetical", "Ordem alfabética"],
                    ["category", "Por categoria"],
                    ["mostRated", "Mais avaliados · Fragrantica"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={draft.productOrder === value ? "active" : ""}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          productOrder: value as CatalogSettings["productOrder"],
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="catalogEditorCoverage">
              <div>
                <ImageIcon />
                <span>
                  <strong>{previewItems.filter((item) => item.imageUrl).length}/{previewItems.length}</strong>
                  imagens identificadas
                </span>
              </div>
              <div className="catalogCoverageActions">
                <button
                  type="button"
                  onClick={async () => {
                    const resolved = await enrichCatalogItemsWithImages(
                      baseItems,
                      undefined,
                      draft.productOrder === "mostRated",
                    );
                    setPreviewItems(resolved);
                  }}
                >
                  <RefreshCw />
                  Atualizar imagens
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageEditorError("");
                    setEditorOpen(false);
                    setImageEditorOpen(true);
                  }}
                >
                  <Pencil />
                  Editar
                </button>
              </div>
            </div>

            <div className="catalogEditorSections">
              {editorSections.map((section) => (
                <section key={section.title} className="catalogEditorSection">
                  <header>
                    <strong>{section.title}</strong>
                    <span>{section.description}</span>
                  </header>
                  <div className="catalogColorGrid">
                    {section.fields.map(([key, label]) => (
                      <CatalogColorField
                        key={key}
                        label={label}
                        value={draft[key]}
                        onChange={(value) => updateDraft(key, value)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>


            <footer>
              <button
                type="button"
                className="catalogResetButton"
                onClick={() =>
                  setDraft({
                    ...DEFAULT_CATALOG_SETTINGS,
                    categoryOrder: [...draft.categoryOrder],
                    productOrder: draft.productOrder,
                    manualImages: { ...draft.manualImages },
                  })
                }
              >
                <RotateCcw />
                Restaurar padrão
              </button>
              <div>
                <button type="button" onClick={() => setEditorOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="catalogSaveButton"
                  onClick={() => {
                    onSettingsChange(normalizeCatalogSettings(draft));
                    setEditorOpen(false);
                  }}
                >
                  <Save />
                  Salvar catálogo
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {imageEditorOpen ? (
        <div
          className="catalogEditorOverlay catalogImageEditorOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setImageEditorOpen(false);
              setEditorOpen(true);
            }
          }}
        >
          <div
            className="catalogImageEditorDialog"
            role="dialog"
            aria-modal="true"
            aria-label="Editar imagens dos perfumes"
          >
            <header>
              <div>
                <span>IMAGENS DO CATÁLOGO</span>
                <h2>Editar imagens dos perfumes</h2>
                <p>
                  Cole o link da imagem ou envie um arquivo para qualquer perfume
                  listado. Ao concluir, você retorna ao editor do catálogo.
                </p>
              </div>
              <button
                type="button"
                aria-label="Voltar ao editor do catálogo"
                onClick={() => {
                  setImageEditorOpen(false);
                  setEditorOpen(true);
                }}
              >
                <X />
              </button>
            </header>

            {imageEditorError ? (
              <p className="catalogImageEditorError">{imageEditorError}</p>
            ) : null}

            <div className="catalogImageEditorList">
              {baseItems.map((item) => {
                const manualValue = draft.manualImages[String(item.id)] || "";
                const resolvedItem = previewItems.find(
                  (preview) => preview.id === item.id,
                );
                const previewUrl =
                  manualValue || resolvedItem?.imageUrl || item.imageUrl || "";
                return (
                  <div className="catalogImageEditorRow" key={item.id}>
                    <div className="catalogManualImageIdentity">
                      <strong>{item.name}</strong>
                      <span>{item.brand}</span>
                    </div>
                    <div className="catalogManualImagePreview">
                      {previewUrl ? (
                        <img src={previewUrl} alt="" />
                      ) : (
                        <ImageIcon />
                      )}
                    </div>
                    <label>
                      <span>Link da imagem</span>
                      <input
                        type="url"
                        value={manualValue.startsWith("data:") ? "" : manualValue}
                        placeholder="https://..."
                        onChange={(event) => {
                          setImageEditorError("");
                          setManualImage(item.id, event.target.value);
                        }}
                      />
                    </label>
                    <label className="catalogUploadImageButton">
                      <Upload />
                      <span>Enviar arquivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (event) => {
                          const input = event.currentTarget;
                          const selected = input.files?.[0];
                          if (!selected) return;
                          try {
                            setImageEditorError("");
                            const dataUrl = await catalogFileToDataUrl(selected);
                            setManualImage(item.id, dataUrl);
                          } catch (error) {
                            setImageEditorError(
                              error instanceof Error
                                ? error.message
                                : "Não foi possível processar a imagem.",
                            );
                          } finally {
                            input.value = "";
                          }
                        }}
                      />
                    </label>
                    {manualValue ? (
                      <button
                        type="button"
                        className="catalogRemoveManualImage"
                        onClick={() => removeManualImage(item.id)}
                      >
                        <Trash2 />
                        Remover manual
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <footer>
              <button
                type="button"
                className="catalogSaveButton"
                onClick={() => {
                  setImageEditorOpen(false);
                  setEditorOpen(true);
                }}
              >
                <Check />
                Concluir
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PublicCatalog() {
  useEffect(() => {
    document.title = "Catálogo | DAF Splits";
  }, []);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [settings, setSettings] = useState<CatalogSettings>(
    DEFAULT_CATALOG_SETTINGS,
  );
  const [updatedAt, setUpdatedAt] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;

    async function localCatalogFallback() {
      try {
        const stored = readCommittedCatalogCache(window.localStorage.getItem(PUBLISHED_CATALOG_KEY));
        if (stored) {
          const snapshot = readCatalogSnapshot(stored.items);
          if (!active) return true;
          setItems(snapshot.items);
          setSettings(snapshot.settings);
          setUpdatedAt(stored.updatedAt);
          setState(snapshot.items.length ? "ready" : "empty");
          return true;
        }
      } catch {
        // Sem dados locais disponíveis.
      }
      return false;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("public_catalogs")
          .select("items, updated_at")
          .eq("slug", "daf-splits")
          .eq("published", true)
          .maybeSingle();

        if (!active) return;

        const snapshot = !error
          ? readCatalogSnapshot(data?.items)
          : { items: [], settings: DEFAULT_CATALOG_SETTINGS };
        const catalogItems = snapshot.items.map((item) =>
          applyKnownFragranticaImage(item),
        );

        if (catalogItems.length) {
          const resolved = await enrichCatalogItemsWithImages(
            catalogItems,
            undefined,
            snapshot.settings.productOrder === "mostRated",
          );
          if (!active) return;
          setItems(resolved);
          setSettings(snapshot.settings);
          setUpdatedAt(String(data?.updated_at || ""));
          setState("ready");
          return;
        }

        if (error && await localCatalogFallback()) return;
        setItems([]); setSettings(snapshot.settings); setUpdatedAt(String(data?.updated_at || ""));
        setState(error ? "error" : "empty");
      } catch {
        if (!active) return;
        if (!(await localCatalogFallback())) setState("error");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="catalogStatePage">
        <img src="/icon-512.png" alt="DAF Splits" />
        <PackageOpen />
        <h1>Carregando catálogo...</h1>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="catalogStatePage">
        <img src="/icon-512.png" alt="DAF Splits" />
        <PackageOpen />
        <h1>Catálogo em preparação</h1>
        <p>
          A estrutura pública já está pronta. Falta apenas ativar a publicação
          segura do estoque no banco de dados.
        </p>
      </div>
    );
  }

  return (
    <CatalogViewer
      items={items}
      settings={settings}
      updatedAt={updatedAt}
    />
  );
}
