import crypto from "node:crypto";

export const SESSION_COOKIE = "daf_me_session";
export const STATE_COOKIE = "daf_me_state";

const DEFAULT_REDIRECT =
  "https://daf-splits-gestao.vercel.app/api/melhor-envio/callback";
const DEFAULT_USER_AGENT = "DAF Splits (dafsplits@gmail.com)";
const SCOPES = [
  "cart-read",
  "cart-write",
  "orders-read",
  "shipping-calculate",
  "shipping-checkout",
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "users-read",
].join(" ");

export function getConfig() {
  const environment =
    String(process.env.MELHOR_ENVIO_ENV || "sandbox").toLowerCase() ===
    "production"
      ? "production"
      : "sandbox";
  const baseUrl =
    environment === "production"
      ? "https://melhorenvio.com.br"
      : "https://sandbox.melhorenvio.com.br";
  const config = {
    environment,
    baseUrl,
    clientId: String(process.env.MELHOR_ENVIO_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.MELHOR_ENVIO_CLIENT_SECRET || "").trim(),
    redirectUri: String(
      process.env.MELHOR_ENVIO_REDIRECT_URI || DEFAULT_REDIRECT,
    ).trim(),
    userAgent: String(
      process.env.MELHOR_ENVIO_USER_AGENT || DEFAULT_USER_AGENT,
    ).trim(),
    scopes: String(process.env.MELHOR_ENVIO_SCOPES || SCOPES).trim(),
  };
  const missing = [];
  if (!config.clientId) missing.push("MELHOR_ENVIO_CLIENT_ID");
  if (!config.clientSecret) missing.push("MELHOR_ENVIO_CLIENT_SECRET");
  return { ...config, configured: missing.length === 0, missing };
}

function parseCookies(req) {
  return String(req.headers?.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index < 0) return acc;
      const key = decodeURIComponent(part.slice(0, index));
      const value = decodeURIComponent(part.slice(index + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function appendCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  const next = Array.isArray(current)
    ? [...current, value]
    : current
      ? [current, value]
      : [value];
  res.setHeader("Set-Cookie", next);
}

export function setCookie(
  res,
  name,
  value,
  { maxAge = 3600, httpOnly = true } = {},
) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (httpOnly) parts.push("HttpOnly");
  appendCookie(res, parts.join("; "));
}

export function clearCookie(res, name) {
  setCookie(res, name, "", { maxAge: 0 });
}

function keyFor(config) {
  return crypto
    .createHash("sha256")
    .update(config.clientSecret, "utf8")
    .digest();
}

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function seal(payload, config) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFor(config), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [b64url(iv), b64url(tag), b64url(encrypted)].join(".");
}

function unseal(value, config) {
  if (!value) return null;
  try {
    const [ivRaw, tagRaw, encryptedRaw] = String(value).split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      keyFor(config),
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

export function createState(res) {
  const state = crypto.randomBytes(24).toString("base64url");
  setCookie(res, STATE_COOKIE, state, { maxAge: 600 });
  return state;
}

export function readState(req) {
  return parseCookies(req)[STATE_COOKIE] || "";
}

export function readSession(req) {
  const config = getConfig();
  if (!config.configured) return null;
  return unseal(parseCookies(req)[SESSION_COOKIE], config);
}

export function saveSession(res, tokenData) {
  const config = getConfig();
  const expiresIn = Math.max(60, Number(tokenData.expires_in || 2592000));
  const session = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type || "Bearer",
    expires_at: Date.now() + expiresIn * 1000,
  };
  setCookie(res, SESSION_COOKIE, seal(session, config), {
    maxAge: 45 * 24 * 60 * 60,
  });
  return session;
}

export function clearSession(res) {
  clearCookie(res, SESSION_COOKIE);
}

export async function requestToken(payload) {
  const config = getConfig();
  if (!config.configured) {
    const error = new Error("Integração do Melhor Envio ainda não configurada.");
    error.status = 503;
    error.details = { missing: config.missing };
    throw error;
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    ...payload,
  });
  const response = await fetch(`${config.baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": config.userAgent,
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error(
      data?.message || data?.error_description || "Falha ao autenticar no Melhor Envio.",
    );
    error.status = response.status || 502;
    error.details = data;
    throw error;
  }
  return data;
}

export async function requireAccessToken(req, res) {
  const config = getConfig();
  if (!config.configured) {
    const error = new Error("Configure as chaves do Melhor Envio na Vercel.");
    error.status = 503;
    error.details = { missing: config.missing };
    throw error;
  }
  const session = readSession(req);
  if (!session?.access_token) {
    const error = new Error("Melhor Envio não conectado.");
    error.status = 401;
    throw error;
  }
  if (Number(session.expires_at || 0) > Date.now() + 120000) {
    return session.access_token;
  }
  if (!session.refresh_token) {
    clearSession(res);
    const error = new Error("A autorização do Melhor Envio expirou.");
    error.status = 401;
    throw error;
  }
  try {
    const refreshed = await requestToken({
      grant_type: "refresh_token",
      refresh_token: session.refresh_token,
    });
    return saveSession(res, refreshed).access_token;
  } catch (error) {
    clearSession(res);
    throw error;
  }
}

export async function melhorEnvioFetch(req, res, path, options = {}) {
  const config = getConfig();
  const token = await requireAccessToken(req, res);
  const headers = {
    Accept: "application/json",
    "User-Agent": config.userAgent,
    Authorization: `Bearer ${token}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers,
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        data?.error_description ||
        "O Melhor Envio recusou a solicitação.",
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export function sendError(res, error) {
  const status = Number(error?.status || 500);
  res.status(status).json({
    ok: false,
    error: error?.message || "Erro inesperado na integração do Melhor Envio.",
    details: error?.details || null,
  });
}

export function onlyMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader("Allow", method);
    res.status(405).json({ ok: false, error: "Método não permitido." });
    return false;
  }
  return true;
}
