import {
  melhorEnvioFetch,
  onlyMethod,
  sendError,
} from "./_lib.js";

function pickTrackingPayload(data, orderId) {
  if (!data) return {};
  if (data[orderId]) return data[orderId];
  if (data.data?.[orderId]) return data.data[orderId];
  if (Array.isArray(data)) {
    return (
      data.find(
        (item) =>
          String(item?.id || item?.order_id || item?.orderId || "") === orderId,
      ) || data[0] || {}
    );
  }
  if (Array.isArray(data.data)) {
    return (
      data.data.find(
        (item) =>
          String(item?.id || item?.order_id || item?.orderId || "") === orderId,
      ) || data.data[0] || {}
    );
  }
  return data.data || data;
}

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST")) return;
  try {
    const orderId = String(req.body?.orderId || "").trim();
    if (!orderId) {
      res.status(400).json({
        ok: false,
        error: "Informe o ID da etiqueta para consultar o rastreio.",
      });
      return;
    }

    const data = await melhorEnvioFetch(
      req,
      res,
      "/api/v2/me/shipment/tracking",
      {
        method: "POST",
        body: { orders: [orderId] },
      },
    );

    const item = pickTrackingPayload(data, orderId);
    res.status(200).json({
      ok: true,
      tracking: {
        status:
          item?.status ||
          item?.order_status ||
          item?.shipment_status ||
          "unknown",
        tracking:
          item?.tracking ||
          item?.tracking_code ||
          item?.code ||
          "",
        protocol:
          item?.protocol ||
          item?.authorization_code ||
          "",
        postedAt:
          item?.posted_at ||
          item?.postedAt ||
          null,
        deliveredAt:
          item?.delivered_at ||
          item?.deliveredAt ||
          null,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}
