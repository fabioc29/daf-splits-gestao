const PUBLIC_ITEM_KEYS = new Set([
  "id",
  "brand",
  "name",
  "category",
  "gender",
  "stock",
  "apc",
  "bottle",
  "imageUrl",
  "fragranticaId",
  "manualImage",
]);

const SETTINGS_KEYS = new Set([
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
  "manualImages",
]);

function sanitizeCatalogItems(value) {
  if (!Array.isArray(value)) return [];

  const sanitized = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

    if ("__catalogSettings" in entry) {
      const source =
        entry.__catalogSettings &&
        typeof entry.__catalogSettings === "object" &&
        !Array.isArray(entry.__catalogSettings)
          ? entry.__catalogSettings
          : {};
      const settings = {};
      for (const [key, val] of Object.entries(source)) {
        if (!SETTINGS_KEYS.has(key)) continue;
        if (key === "manualImages") {
          if (!val || typeof val !== "object" || Array.isArray(val)) continue;
          settings.manualImages = Object.fromEntries(
            Object.entries(val)
              .filter(
                ([productId, image]) =>
                  /^\d+$/.test(String(productId)) &&
                  typeof image === "string" &&
                  image.length <= 1_600_000,
              )
              .map(([productId, image]) => [String(productId), image]),
          );
          continue;
        }
        if (typeof val === "string" && val.length <= 100) settings[key] = val;
      }
      sanitized.push({ __catalogSettings: settings });
      continue;
    }

    const product = {};
    for (const [key, val] of Object.entries(entry)) {
      if (!PUBLIC_ITEM_KEYS.has(key)) continue;
      if (
        ["id", "stock", "bottle", "fragranticaId"].includes(key) &&
        Number.isFinite(Number(val))
      ) {
        product[key] = Number(val);
      } else if (["apc", "manualImage"].includes(key)) {
        product[key] = Boolean(val);
      } else if (typeof val === "string" && val.length <= 1_600_000) {
        product[key] = val;
      }
    }

    if (
      Number.isFinite(product.id) &&
      typeof product.brand === "string" &&
      typeof product.name === "string"
    ) {
      sanitized.push(product);
    }
  }

  return sanitized;
}

async function verifyManagementSession(token) {
  const sourceUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const sourceKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  if (!sourceUrl || !sourceKey || !token) return false;

  const response = await fetch(sourceUrl + "/auth/v1/user", {
    headers: {
      apikey: sourceKey,
      Authorization: "Bearer " + token,
    },
  });
  return response.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!(await verifyManagementSession(token))) {
    res.status(401).json({ error: "Sessão administrativa inválida." });
    return;
  }

  const mirrorUrl = String(process.env.CATALOG_MIRROR_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const serviceRole = String(
    process.env.CATALOG_MIRROR_SERVICE_ROLE_KEY || "",
  ).trim();

  if (!mirrorUrl || !serviceRole) {
    res.status(503).json({
      error: "Espelho público ainda não configurado no servidor.",
      code: "CATALOG_MIRROR_NOT_CONFIGURED",
    });
    return;
  }

  const revision = String(req.body?.revision || "").trim();
  const items = sanitizeCatalogItems(req.body?.items);
  if (!/^\d+$/.test(revision) || !items.length) {
    res.status(400).json({ error: "Snapshot público inválido." });
    return;
  }

  const response = await fetch(
    mirrorUrl + "/rest/v1/public_catalogs?on_conflict=slug",
    {
      method: "POST",
      headers: {
        apikey: serviceRole,
        Authorization: "Bearer " + serviceRole,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        slug: "daf-splits",
        items,
        published: true,
        source_revision: revision,
        updated_at:
          typeof req.body?.updatedAt === "string"
            ? req.body.updatedAt
            : new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    res.status(502).json({
      error: "Não foi possível atualizar o catálogo espelho.",
      details: details.slice(0, 500),
    });
    return;
  }

  res.status(200).json({
    ok: true,
    revision,
    items: items.filter((entry) => !("__catalogSettings" in entry)).length,
  });
}
