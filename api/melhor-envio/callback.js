import {
  clearCookie,
  getConfig,
  readState,
  requestToken,
  saveSession,
  sendError,
  STATE_COOKIE,
} from "./_lib.js";

export default async function handler(req, res) {
  try {
    const config = getConfig();
    if (!config.configured) {
      const error = new Error("As chaves do Melhor Envio não estão configuradas.");
      error.status = 503;
      error.details = { missing: config.missing };
      throw error;
    }

    const errorParam =
      typeof req.query?.error === "string" ? req.query.error : "";
    if (errorParam) {
      res.redirect(
        302,
        "/?melhor_envio=error&message=" +
          encodeURIComponent(errorParam),
      );
      return;
    }

    const code = typeof req.query?.code === "string" ? req.query.code : "";
    const state = typeof req.query?.state === "string" ? req.query.state : "";
    const expectedState = readState(req);

    if (!code) {
      const error = new Error("Código OAuth não recebido pelo Melhor Envio.");
      error.status = 400;
      throw error;
    }
    if (!state || !expectedState || state !== expectedState) {
      const error = new Error(
        "Não foi possível validar o retorno de autorização do Melhor Envio.",
      );
      error.status = 400;
      throw error;
    }

    const tokenData = await requestToken({
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    });
    saveSession(res, tokenData);
    clearCookie(res, STATE_COOKIE);
    res.redirect(302, "/?melhor_envio=connected");
  } catch (error) {
    if (res.headersSent) return;
    sendError(res, error);
  }
}
