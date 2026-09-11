import {
  getConfig,
  melhorEnvioFetch,
  onlyMethod,
  readSession,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "GET")) return;
  const config = getConfig();
  if (!config.configured) {
    res.status(200).json({
      ok: true,
      configured: false,
      connected: false,
      environment: config.environment,
      missing: config.missing,
    });
    return;
  }

  if (!readSession(req)) {
    res.status(200).json({
      ok: true,
      configured: true,
      connected: false,
      environment: config.environment,
    });
    return;
  }

  try {
    const user = await melhorEnvioFetch(req, res, "/api/v2/me");
    res.status(200).json({
      ok: true,
      configured: true,
      connected: true,
      environment: config.environment,
      user: {
        name: user?.firstname
          ? [user.firstname, user.lastname].filter(Boolean).join(" ")
          : user?.name || "",
        email: user?.email || "",
      },
    });
  } catch (error) {
    res.status(200).json({
      ok: true,
      configured: true,
      connected: false,
      environment: config.environment,
      reason: error?.message || "Não conectado",
    });
  }
}
