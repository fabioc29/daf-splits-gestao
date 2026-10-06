import { useEffect, useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
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
  imageUrl?: string;
  fragranticaId?: number;
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
  { aliases: ["world cup vip"], id: 138880 },
  { aliases: ["world cup edition"], id: 138879 },
  // O estoque da DAF já teve "World Cup VIP" abreviado apenas como "World Cup".
  { aliases: ["world cup"], id: 138880 },
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
    if (entry.aliases.some((alias) => normalized === alias)) return entry.id;
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
  if (item.imageUrl) return item;
  const id = knownFragranticaId(item.name, bottle);
  if (!id) return item;
  return {
    ...item,
    fragranticaId: id,
    imageUrl: fragranticaSocialCardUrl(id),
  };
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
  updatedAt: _updatedAt,
  adminPreview = false,
}: {
  items: CatalogItem[];
  updatedAt?: string;
  adminPreview?: boolean;
}) {
  const [category, setCategory] = useState("Todos");
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (item) => category === "Todos" || item.category === category,
      ),
    [items, category],
  );

  return (
    <div className={adminPreview ? "catalogExperience embedded" : "catalogExperience"}>
      <header className={"catalogHeader" + (headerScrolled ? " scrolled" : "")}>
        <div className="catalogHeaderInner">
          <img src="/icon-512.png" alt="DAF Splits" className="catalogHeaderLogo" />
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

        <section className="catalogIntro">
          <h1>Perfumes disponíveis</h1>

          <div className="catalogSimpleFilters">
            <div className="catalogFilterGroup">
              <span>Categoria</span>
              <div>
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
            </div>
          </div>
        </section>

        {filtered.length ? (
          <section className="catalogGrid">
            {filtered.map((item) => (
              <article className="catalogCard" key={item.id}>
                <div className={item.apc ? "catalogApcBanner yes" : "catalogApcBanner no"}>
                  <span />
                  <strong>{item.apc ? "APC Disponível" : "APC Indisponível"}</strong>
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

                <div className="catalogCardTop">
                  <span className={"catalogCategory " + item.category.toLowerCase()}>
                    {item.category}
                  </span>
                  <span className="catalogGender">{item.gender}</span>
                </div>

                <div className="catalogCardIdentity">
                  <span>{item.brand}</span>
                  <h3>{item.name}</h3>
                </div>

                <div className="catalogAvailability">
                  <div>
                    <small>Disponível para decants</small>
                    <b>{item.stock.toLocaleString("pt-BR")} ml</b>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="catalogEmpty">
            <PackageOpen />
            <h3>Nenhum perfume encontrado</h3>
            <p>Altere os filtros para visualizar outros perfumes.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export function CatalogAdminPreview({ products }: { products: ProductLike[] }) {
  const baseItems = useMemo(() => catalogItemsFromProducts(products), [products]);
  const [previewItems, setPreviewItems] = useState(baseItems);

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

  return (
    <CatalogViewer
      items={previewItems}
      updatedAt={new Date().toISOString()}
      adminPreview
    />
  );
}

export function PublicCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;

    function localCatalogFallback() {
      try {
        const stored = JSON.parse(window.localStorage.getItem("daf-v4") || "null");
        const fallbackItems = catalogItemsFromProducts(
          Array.isArray(stored?.products) ? stored.products : [],
        );
        if (fallbackItems.length) {
          setItems(fallbackItems);
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

        const catalogItems = !error && Array.isArray(data?.items)
          ? (data.items as CatalogItem[]).map((item) =>
              applyKnownFragranticaImage(item),
            )
          : [];

        if (catalogItems.length) {
          const resolved = await enrichCatalogItemsWithImages(catalogItems);
          if (!active) return;
          setItems(resolved);
          setUpdatedAt(String(data?.updated_at || ""));
          setState("ready");
          return;
        }

        if (localCatalogFallback()) return;
        setState(error ? "error" : "empty");
      } catch {
        if (!active) return;
        if (!localCatalogFallback()) setState("error");
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

  return <CatalogViewer items={items} updatedAt={updatedAt} />;
}
