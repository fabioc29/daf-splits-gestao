import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  Image as ImageIcon,
  MessageCircle,
  PackageOpen,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import { supabase } from "./supabase";
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

const CATALOG_SETTINGS_KEYS = Object.keys(
  DEFAULT_CATALOG_SETTINGS,
) as Array<keyof CatalogSettings>;

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
  return CATALOG_SETTINGS_KEYS.reduce(
    (settings, key) => {
      const incoming = normalizeHex(
        source[key],
        DEFAULT_CATALOG_SETTINGS[key],
      );
      settings[key] =
        incoming === LEGACY_CATALOG_SETTINGS[key]
          ? DEFAULT_CATALOG_SETTINGS[key]
          : incoming;
      return settings;
    },
    { ...DEFAULT_CATALOG_SETTINGS },
  );
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
): Promise<CatalogItem[]> {
  const known = items.map((item) => applyKnownFragranticaImage(item));

  return Promise.all(
    known.map(async (item) => {
      if (item.imageUrl) return item;

      const cacheKey =
        "daf-fragrantica:" +
        normalizePerfumeName(item.brand + " " + item.name);

      try {
        const cached =
          typeof window !== "undefined"
            ? window.localStorage.getItem(cacheKey)
            : null;
        if (validFragranticaImageUrl(cached)) {
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
        const response = await fetch("/api/fragrantica-image?" + params.toString());
        if (!response.ok) return item;
        const data = await response.json();
        if (!validFragranticaImageUrl(data?.imageUrl)) return item;

        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(cacheKey, data.imageUrl);
          }
        } catch {
          // Falha de cache não impede o catálogo.
        }

        return {
          ...item,
          imageUrl: data.imageUrl,
          fragranticaId: Number(data.fragranticaId) || undefined,
        };
      } catch {
        return item;
      }
    }),
  );
}

export function catalogItemsFromProducts(products: ProductLike[]): CatalogItem[] {
  return products
    .map((product) =>
      applyKnownFragranticaImage(
        {
          id: product.id,
          brand: String(product.brand || "").trim(),
          name: String(product.name || "").trim(),
          category: String(product.category || "Outros").trim(),
          gender: String(product.gender || "Unissex").trim(),
          stock: Math.max(0, Number(product.stock) || 0),
          apc: Number(product.apc || 0) > 0,
          bottle: Math.max(0, Number(product.bottle) || 0) || undefined,
        },
        product.bottle,
      ),
    )
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

  const filtered = useMemo(() => {
    const normalizedQuery = normalizePerfumeName(query);
    return items.filter((item) => {
      const matchesCategory =
        category === "Todos" || item.category === category;
      const matchesQuery =
        !normalizedQuery ||
        normalizePerfumeName(`${item.brand} ${item.name}`).includes(
          normalizedQuery,
        );
      return matchesCategory && matchesQuery;
    });
  }, [items, category, query]);

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

            {["Todos", "Nicho", "Árabe", "Designer"].map((option) => (
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
  const baseItems = useMemo(() => catalogItemsFromProducts(products), [products]);
  const [previewItems, setPreviewItems] = useState(baseItems);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogSettings>(normalizedSettings);

  useEffect(() => {
    let active = true;
    setPreviewItems(baseItems);
    enrichCatalogItemsWithImages(baseItems).then((resolved) => {
      if (active) setPreviewItems(resolved);
    });
    return () => {
      active = false;
    };
  }, [baseItems]);

  useEffect(() => {
    if (!editorOpen) setDraft(normalizedSettings);
  }, [normalizedSettings, editorOpen]);

  const updateDraft = (key: keyof CatalogSettings, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const editorSections: Array<{
    title: string;
    description: string;
    fields: Array<[keyof CatalogSettings, string]>;
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
                <span>Nicho</span>
                <span>Árabe</span>
                <strong>Designer</strong>
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

            <div className="catalogEditorCoverage">
              <div>
                <ImageIcon />
                <span>
                  <strong>{previewItems.filter((item) => item.imageUrl).length}/{previewItems.length}</strong>
                  imagens identificadas
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const resolved = await enrichCatalogItemsWithImages(baseItems);
                  setPreviewItems(resolved);
                }}
              >
                <RefreshCw />
                Atualizar imagens
              </button>
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
                onClick={() => setDraft({ ...DEFAULT_CATALOG_SETTINGS })}
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
                  Salvar cores
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PublicCatalog() {
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
        const stored = JSON.parse(window.localStorage.getItem("daf-v4") || "null");
        const fallbackItems = catalogItemsFromProducts(
          Array.isArray(stored?.products) ? stored.products : [],
        );
        if (fallbackItems.length) {
          const resolved = await enrichCatalogItemsWithImages(fallbackItems);
          if (!active) return true;
          setItems(resolved);
          setSettings(normalizeCatalogSettings(stored?.catalogSettings));
          setUpdatedAt(new Date().toISOString());
          setState("ready");
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
          const resolved = await enrichCatalogItemsWithImages(catalogItems);
          if (!active) return;
          setItems(resolved);
          setSettings(snapshot.settings);
          setUpdatedAt(String(data?.updated_at || ""));
          setState("ready");
          return;
        }

        if (await localCatalogFallback()) return;
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
