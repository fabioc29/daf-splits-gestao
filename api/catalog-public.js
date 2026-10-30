import { list } from "@vercel/blob";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 405, { error: "Método não permitido." });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json(res, 503, { error: "Catálogo público ainda não configurado." });
  }

  try {
    const pathname =
      process.env.VERCEL_ENV === "production"
        ? "daf-public-catalog.json"
        : "daf-public-catalog-preview.json";
    const result = await list({ prefix: pathname, limit: 20 });
    const blob = (result.blobs || []).find((item) => item.pathname === pathname);
    if (!blob) {
      return json(res, 404, { error: "Snapshot público ainda não publicado." });
    }

    const response = await fetch(blob.url + "?v=" + Date.now(), {
      cache: "no-store",
    });
    if (!response.ok) {
      return json(res, 502, { error: "Snapshot público indisponível." });
    }
    const snapshot = await response.json();
    if (!snapshot || !Array.isArray(snapshot.items)) {
      return json(res, 502, { error: "Snapshot público inválido." });
    }

    return json(res, 200, {
      items: snapshot.items,
      updated_at: snapshot.updatedAt || "",
      revision: snapshot.revision || "",
    });
  } catch (error) {
    console.error("catalog-public", error);
    return json(res, 500, { error: "Não foi possível ler o catálogo público." });
  }
}
