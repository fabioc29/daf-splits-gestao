const ALLOWED_RPCS = new Set([
  "daf_read_app_state",
  "daf_bootstrap_app_state",
  "daf_save_app_state",
  "daf_publish_catalog",
]);

function getConfig() {
  const url = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.VITE_SUPABASE_ANON_KEY || "");
  return { url, key };
}

function safeError(payload, status) {
  if (payload && typeof payload === "object") {
    return {
      code: String(payload.code || status || "STATE_PROXY_ERROR"),
      message: String(payload.message || payload.error || "Falha ao acessar o Supabase."),
      details: payload.details ?? null,
      hint: payload.hint ?? null,
    };
  }
  return {
    code: String(status || "STATE_PROXY_ERROR"),
    message: String(payload || "Falha ao acessar o Supabase."),
    details: null,
    hint: null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ data: null, error: { code: "405", message: "Método não permitido." } });
    return;
  }

  const { url, key } = getConfig();
  if (!url || !key) {
    res.status(500).json({
      data: null,
      error: {
        code: "SUPABASE_NOT_CONFIGURED",
        message: "Supabase não configurado no servidor.",
      },
    });
    return;
  }

  const rpc = String(req.body?.rpc || "");
  if (!ALLOWED_RPCS.has(rpc)) {
    res.status(400).json({
      data: null,
      error: { code: "RPC_NOT_ALLOWED", message: "Operação não permitida." },
    });
    return;
  }

  const authorization = String(req.headers.authorization || "");
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    res.status(401).json({
      data: null,
      error: { code: "AUTH_REQUIRED", message: "Sessão não informada." },
    });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      `${url}/rest/v1/rpc/${encodeURIComponent(rpc)}`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: authorization,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req.body?.args || {}),
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    }

    res.setHeader("Cache-Control", "no-store");

    if (!response.ok) {
      res.status(response.status).json({
        data: null,
        error: safeError(payload, response.status),
      });
      return;
    }

    res.status(200).json({ data: payload, error: null });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    res.status(504).json({
      data: null,
      error: {
        code: timedOut ? "SUPABASE_PROXY_TIMEOUT" : "SUPABASE_PROXY_FAILED",
        message: timedOut
          ? "O Supabase demorou demais para responder ao servidor."
          : String(error?.message || "Falha ao acessar o Supabase pelo servidor."),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
