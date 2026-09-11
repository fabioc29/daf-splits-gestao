import {
  createState,
  getConfig,
  onlyMethod,
  sendError,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "GET")) return;
  try {
    const config = getConfig();
    if (!config.configured) {
      const error = new Error(
        "Configure MELHOR_ENVIO_CLIENT_ID e MELHOR_ENVIO_CLIENT_SECRET na Vercel.",
      );
      error.status = 503;
      error.details = { missing: config.missing };
      throw error;
    }
    const state = createState(res);
    const query = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      state,
      scope: config.scopes,
    });
    res.redirect(302, `${config.baseUrl}/oauth/authorize?${query.toString()}`);
  } catch (error) {
    sendError(res, error);
  }
}
