import {
  melhorEnvioFetch,
  onlyMethod,
  sendError,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST")) return;
  try {
    const orderId = String(req.body?.orderId || "").trim();
    if (!orderId) {
      res.status(400).json({ ok: false, error: "Informe o ID da etiqueta." });
      return;
    }
    const data = await melhorEnvioFetch(
      req,
      res,
      "/api/v2/me/shipment/print",
      {
        method: "POST",
        body: { mode: "public", orders: [orderId] },
      },
    );
    res.status(200).json({
      ok: true,
      printUrl: data?.url || data?.link || data?.data?.url || data?.data?.link || "",
    });
  } catch (error) {
    sendError(res, error);
  }
}
