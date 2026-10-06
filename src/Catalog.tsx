import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Sparkles,
  XCircle,
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
};

type ProductLike = {
  id: number;
  brand: string;
  name: string;
  category: string;
  gender?: string;
  stock: number;
  apc: number;
};

export function catalogItemsFromProducts(products: ProductLike[]): CatalogItem[] {
  return products
    .map((product) => ({
      id: product.id,
      brand: String(product.brand || "").trim(),
      name: String(product.name || "").trim(),
      category: String(product.category || "Outros").trim(),
      gender: String(product.gender || "Unissex").trim(),
      stock: Math.max(0, Number(product.stock) || 0),
      apc: Number(product.apc || 0) > 0,
    }))
    .filter((item) => item.stock > 0)
    .sort((a, b) =>
      `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, "pt-BR", {
        sensitivity: "base",
      }),
    );
}

function catalogDate(value?: string) {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function CatalogViewer({
  items,
  updatedAt,
  adminPreview = false,
}: {
  items: CatalogItem[];
  updatedAt?: string;
  adminPreview?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [gender, setGender] = useState("Todos");
  const [brand, setBrand] = useState("Todas");
  const [apcOnly, setApcOnly] = useState(false);

  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [items],
  );
  const genders = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.gender).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [items],
  );
  const brands = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.brand).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
      ),
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const searchText = `${item.brand} ${item.name}`.toLocaleLowerCase("pt-BR");
      return (
        (!normalizedQuery || searchText.includes(normalizedQuery)) &&
        (category === "Todos" || item.category === category) &&
        (gender === "Todos" || item.gender === gender) &&
        (brand === "Todas" || item.brand === brand) &&
        (!apcOnly || item.apc)
      );
    });
  }, [items, query, category, gender, brand, apcOnly]);

  const totalMl = items.reduce((sum, item) => sum + item.stock, 0);
  const apcCount = items.filter((item) => item.apc).length;

  return (
    <div className={adminPreview ? "catalogExperience embedded" : "catalogExperience"}>
      <header className="catalogHero">
        <div className="catalogBrand">
          <img src="/icon-512.png" alt="DAF Splits" />
          <div>
            <span>DAF SPLITS</span>
            <small>O luxo que cabe no seu bolso</small>
          </div>
        </div>

        <div className="catalogHeroCopy">
          <span className="catalogEyebrow">
            <Sparkles />
            Catálogo atualizado pelo estoque
          </span>
          <h1>Encontre seu próximo perfume.</h1>
          <p>
            Consulte em tempo real os perfumes disponíveis, quantidade restante
            para decants e disponibilidade de APC.
          </p>
        </div>

        <div className="catalogStats">
          <div>
            <span>Perfumes disponíveis</span>
            <b>{items.length}</b>
          </div>
          <div>
            <span>Volume disponível</span>
            <b>{totalMl.toLocaleString("pt-BR")} ml</b>
          </div>
          <div>
            <span>Com APC disponível</span>
            <b>{apcCount}</b>
          </div>
        </div>
      </header>

      <main className="catalogMain">
        {adminPreview ? (
          <div className="catalogPreviewNotice">
            <PackageOpen />
            <div>
              <strong>Prévia administrativa</strong>
              <span>
                Esta visualização usa diretamente o estoque atual do sistema.
              </span>
            </div>
          </div>
        ) : null}

        <section className="catalogControls">
          <label className="catalogSearch">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar perfume ou marca..."
              aria-label="Buscar perfume ou marca"
            />
          </label>

          <div className="catalogFilters">
            <label>
              <span>Marca</span>
              <select value={brand} onChange={(event) => setBrand(event.target.value)}>
                <option value="Todas">Todas as marcas</option>
                {brands.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Categoria</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="Todos">Todas</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Público</span>
              <select value={gender} onChange={(event) => setGender(event.target.value)}>
                <option value="Todos">Todos</option>
                {genders.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={apcOnly ? "catalogApcFilter active" : "catalogApcFilter"}
              onClick={() => setApcOnly((value) => !value)}
            >
              <SlidersHorizontal />
              Somente com APC
            </button>
          </div>
        </section>

        <div className="catalogResultsHead">
          <div>
            <span>Disponibilidade atual</span>
            <h2>
              {filtered.length} perfume{filtered.length === 1 ? "" : "s"}
            </h2>
          </div>
          <small>Atualizado em {catalogDate(updatedAt)}</small>
        </div>

        {filtered.length ? (
          <section className="catalogGrid">
            {filtered.map((item) => (
              <article className="catalogCard" key={item.id}>
                <div className="catalogBottleVisual" aria-hidden="true">
                  <div className="catalogBottleCap" />
                  <div className="catalogBottleBody">
                    <span>{item.brand.slice(0, 1).toUpperCase()}</span>
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
                  <div className={item.apc ? "catalogApc yes" : "catalogApc no"}>
                    {item.apc ? <CheckCircle2 /> : <XCircle />}
                    <span>{item.apc ? "APC disponível" : "Sem APC"}</span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="catalogEmpty">
            <PackageOpen />
            <h3>Nenhum perfume encontrado</h3>
            <p>Altere os filtros ou faça uma nova busca.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export function CatalogAdminPreview({ products }: { products: ProductLike[] }) {
  return (
    <CatalogViewer
      items={catalogItemsFromProducts(products)}
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
    (async () => {
      const { data, error } = await supabase
        .from("public_catalogs")
        .select("items, updated_at")
        .eq("slug", "daf-splits")
        .eq("published", true)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setState("error");
        return;
      }

      const catalogItems = Array.isArray(data?.items)
        ? (data.items as CatalogItem[])
        : [];
      setItems(catalogItems);
      setUpdatedAt(String(data?.updated_at || ""));
      setState(catalogItems.length ? "ready" : "empty");
    })();

    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="catalogStatePage">
        <img src="/icon-512.png" alt="DAF Splits" />
        <Sparkles />
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
