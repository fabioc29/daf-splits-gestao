const DESIGNER_SLUGS = {
  armaf: "Armaf",
  bidaya: "Bidaya-Parfums",
  "bidaya parfums": "Bidaya-Parfums",
  "carolina herrera": "Carolina-Herrera",
  chanel: "Chanel",
  dior: "Dior",
  "french avenue": "French-Avenue",
  jpg: "Jean-Paul-Gaultier",
  "jean paul gaultier": "Jean-Paul-Gaultier",
  khadlaj: "Khadlaj-Perfumes",
  "khadlaj perfumes": "Khadlaj-Perfumes",
  lancome: "Lancome",
  lattafa: "Lattafa-Perfumes",
  "lattafa perfumes": "Lattafa-Perfumes",
  "maison asrar": "MAISON-ASRAR",
  mancera: "Mancera",
  nishane: "Nishane",
  "parfums de marly": "Parfums-de-Marly",
  rasasi: "Rasasi",
  armani: "Giorgio-Armani",
  "giorgio armani": "Giorgio-Armani",
  "emporio armani": "Giorgio-Armani",
  "tiziana terenzi": "Tiziana-Terenzi",
  valentino: "Valentino",
  xerjoff: "Xerjoff",
  ysl: "Yves-Saint-Laurent",
  "yves saint laurent": "Yves-Saint-Laurent",
  zakat: "Zakat",
  "zakat parfums": "Zakat",
  sospiro: "Sospiro-Perfumes",
};

const SOCIAL_CARD_BASE =
  "https://www.fragrantica.com.br/mdimg/perfume-social-cards/pt-p_c_";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function candidateNameFromPath(path) {
  const file = path.split("/").pop() || "";
  return decodeURIComponent(file)
    .replace(/-\d+\.html(?:\?.*)?$/i, "")
    .replace(/-/g, " ");
}

function extractCandidates(html) {
  const candidates = new Map();
  const regex =
    /href=["'](?:https?:\/\/(?:www\.)?fragrantica\.com\.br)?(\/perfume\/[^"'?#]+?-(\d+)\.html(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const path = match[1];
    const id = Number(match[2]);
    if (!Number.isFinite(id)) continue;
    const label = decodeHtml(match[3]);
    const slugName = candidateNameFromPath(path);
    const name = normalize(label + " " + slugName);
    if (!candidates.has(id)) candidates.set(id, { id, path, name });
  }
  return [...candidates.values()];
}

function similarity(target, candidate) {
  const a = normalize(target);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a)) return 0.96;
  if (a.includes(b) && b.length >= Math.min(8, a.length)) return 0.88;

  const aTokens = a.split(" ").filter((token) => token.length > 1);
  const bTokens = new Set(b.split(" ").filter((token) => token.length > 1));
  if (!aTokens.length) return 0;

  let matched = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) matched += 1;
  }
  return matched / aTokens.length;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
    },
    redirect: "follow",
  });
  if (!response.ok) return "";
  return response.text();
}

async function resolveFromDesigner(brand, name) {
  const normalizedBrand = normalize(brand);
  const mapped = DESIGNER_SLUGS[normalizedBrand];
  const generic = slugify(brand);
  const slugs = [...new Set([mapped, generic].filter(Boolean))];

  let candidates = [];
  for (const slug of slugs) {
    for (const directory of ["designers", "desenhista"]) {
      try {
        const html = await fetchText(
          `https://www.fragrantica.com.br/${directory}/${slug}.html`,
        );
        if (html) candidates.push(...extractCandidates(html));
      } catch {
        // tenta próxima variante
      }
    }
  }

  const target = normalize(name);
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: similarity(target, candidate.name),
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0]?.score >= 0.66) return ranked[0];
  return null;
}

async function resolveFromSearch(brand, name) {
  const query = `site:fragrantica.com.br/perfume "${brand}" "${name}"`;
  try {
    const html = await fetchText(
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
    );
    if (!html) return null;

    const decoded = decodeURIComponent(
      html
        .replace(/&amp;/g, "&")
        .replace(/%25/g, "%"),
    );

    const regex =
      /https?:\/\/(?:www\.)?fragrantica\.com\.br\/perfume\/[^"'<>\s]+?-(\d+)\.html/gi;
    const found = [];
    let match;
    while ((match = regex.exec(decoded))) {
      const url = match[0];
      const id = Number(match[1]);
      if (!Number.isFinite(id)) continue;
      found.push({
        id,
        path: url,
        name: normalize(candidateNameFromPath(url)),
      });
    }

    const target = normalize(name);
    const ranked = found
      .map((candidate) => ({
        ...candidate,
        score: similarity(target, candidate.name),
      }))
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.score >= 0.66 ? ranked[0] : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const brand = String(req.query?.brand || "").trim().slice(0, 100);
  const name = String(req.query?.name || "").trim().slice(0, 160);

  if (!name) {
    res.status(400).json({ error: "Nome do perfume é obrigatório." });
    return;
  }

  try {
    const match =
      (await resolveFromDesigner(brand, name)) ||
      (await resolveFromSearch(brand, name));

    if (!match?.id) {
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      res.status(404).json({ error: "Perfume não localizado na Fragrantica." });
      return;
    }

    const imageUrl = `${SOCIAL_CARD_BASE}${match.id}.jpeg`;
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=604800, stale-while-revalidate=2592000",
    );
    res.status(200).json({
      fragranticaId: match.id,
      imageUrl,
      sourceUrl: match.path.startsWith("http")
        ? match.path
        : "https://www.fragrantica.com.br" + match.path,
    });
  } catch (error) {
    res.status(500).json({
      error: "Não foi possível localizar a imagem na Fragrantica.",
      detail: error?.message || "Erro desconhecido",
    });
  }
}
