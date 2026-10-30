import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

const CATALOG_PRESENTATION_META_KEY = "999999999999999";
const CATALOG_PRESENTATION_META_PREFIX = "__daf_catalog_presentation_v1__:";
const CATALOG_CATEGORIES = ["Nicho", "Árabe", "Designer"];
const COLOR_KEYS = [
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
];

function safeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const manualImages =
    source.manualImages && typeof source.manualImages === "object"
      ? Object.fromEntries(
          Object.entries(source.manualImages)
            .filter(([key, image]) => key !== CATALOG_PRESENTATION_META_KEY && typeof image === "string" && image.trim())
            .map(([key, image]) => [String(key), String(image).trim()]),
        )
      : {};
  const categoryOrder = Array.isArray(source.categoryOrder)
    ? source.categoryOrder
        .map((item) => String(item || "").trim())
        .filter((item) => CATALOG_CATEGORIES.includes(item))
    : [];
  const completeCategoryOrder = [
    ...Array.from(new Set(categoryOrder)),
    ...CATALOG_CATEGORIES.filter((category) => !categoryOrder.includes(category)),
  ];
  const productOrder =
    source.productOrder === "category" || source.productOrder === "mostRated"
      ? source.productOrder
      : "alphabetical";
  const settings = { manualImages };
  for (const key of COLOR_KEYS) {
    if (typeof source[key] === "string" && source[key].trim()) {
      settings[key] = source[key].trim();
    }
  }
  settings.manualImages = {
    ...manualImages,
    [CATALOG_PRESENTATION_META_KEY]:
      CATALOG_PRESENTATION_META_PREFIX +
      JSON.stringify({
        categoryOrder: completeCategoryOrder,
        productOrder,
      }),
  };
  return settings;
}

function catalogSnapshot(state) {
  const products = Array.isArray(state?.products) ? state.products : [];
  const settings = safeSettings(state?.catalogSettings);
  const manualImages = settings.manualImages || {};
  const items = products
    .map((product) => {
      const id = Number(product?.id);
      const stock = Math.max(0, Number(product?.stock) || 0);
      if (!Number.isFinite(id) || stock <= 0) return null;
      const item = {
        id,
        brand: String(product?.brand || "").trim(),
        name: String(product?.name || "").trim(),
        category: String(product?.category || "Outros").trim(),
        gender: String(product?.gender || "Unissex").trim(),
        stock,
        apc: Number(product?.apc || 0) > 0,
      };
      const manualImage = String(manualImages[String(id)] || "").trim();
      if (manualImage) {
        item.imageUrl = manualImage;
        item.manualImage = true;
      }
      return item;
    })
    .filter(Boolean)
    .sort((a, b) =>
      `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, "pt-BR", {
        sensitivity: "base",
      }),
    );

  return [{ __catalogSettings: settings }, ...items];
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Método não permitido." });
  }

  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return json(res, 401, { error: "Sessão ausente." });

  const url = String(process.env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  ).trim();
  if (!url || !publishableKey || !process.env.BLOB_READ_WRITE_TOKEN) {
    return json(res, 503, { error: "Sincronização pública não configurada." });
  }

  try {
    const client = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data, error } = await client.rpc("daf_read_app_state");
    if (error || !data?.data) {
      return json(res, error?.status === 401 ? 401 : 403, {
        error: "Sessão sem permissão para publicar o catálogo.",
      });
    }

    const items = catalogSnapshot(data.data);
    const updatedAt = new Date().toISOString();
    const payload = JSON.stringify({
      format: "daf-public-catalog-blob-v1",
      revision: String(data.revision || ""),
      updatedAt,
      items,
    });
    const pathname =
      process.env.VERCEL_ENV === "production"
        ? "daf-public-catalog.json"
        : "daf-public-catalog-preview.json";

    const blob = await put(pathname, payload, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
    });

    return json(res, 200, {
      ok: true,
      updatedAt,
      count: Math.max(0, items.length - 1),
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("catalog-sync", error);
    return json(res, 500, { error: "Não foi possível sincronizar o catálogo." });
  }
}
