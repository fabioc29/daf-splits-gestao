import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  PackageOpen,
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
  const [gender, setGender] = useState("Todos");

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "Todos" || item.category === category) &&
          (gender === "Todos" || item.gender === gender),
      ),
    [items, category, gender],
  );

  return (
    <div className={adminPreview ? "catalogExperience embedded" : "catalogExperience"}>
      <header className="catalogHeader">
        <div className="catalogBrand">
          <img src="/icon-512.png" alt="DAF Splits" />
          <div>
            <span>DAF SPLITS</span>
            <small>O luxo que cabe no seu bolso</small>
          </div>
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
              <span>Público</span>
              <div>
                {["Todos", "Masculino", "Feminino"].map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={gender === option ? "active" : ""}
                    onClick={() => setGender(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

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
            <p>Altere os filtros para visualizar outros perfumes.</p>
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
          ? (data.items as CatalogItem[])
          : [];

        if (catalogItems.length) {
          setItems(catalogItems);
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
