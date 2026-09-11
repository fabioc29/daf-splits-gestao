import {
  melhorEnvioFetch,
  onlyMethod,
  sendError,
} from "./_lib.js";

const number = (value) => Number(String(value ?? "").replace(",", "."));

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST")) return;
  try {
    const body = req.body || {};
    const fromPostalCode = String(body.fromPostalCode || "").replace(/\D/g, "");
    const toPostalCode = String(body.toPostalCode || "").replace(/\D/g, "");
    const volume = {
      width: number(body.width),
      height: number(body.height),
      length: number(body.length),
      weight: number(body.weight),
      insurance: Math.max(0, number(body.insuranceValue)),
    };

    if (
      fromPostalCode.length !== 8 ||
      toPostalCode.length !== 8 ||
      !volume.width ||
      !volume.height ||
      !volume.length ||
      !volume.weight
    ) {
      res.status(400).json({
        ok: false,
        error: "Informe CEPs, dimensões e peso válidos para realizar a cotação.",
      });
      return;
    }

    const data = await melhorEnvioFetch(
      req,
      res,
      "/api/v2/me/shipment/calculate",
      {
        method: "POST",
        body: {
          from: { postal_code: fromPostalCode },
          to: { postal_code: toPostalCode },
          volumes: [volume],
          options: { receipt: false, own_hand: false },
        },
      },
    );

    const services = (Array.isArray(data) ? data : [])
      .filter((service) => !service?.error && service?.id)
      .map((service) => ({
        id: service.id,
        name: service.name || "Serviço",
        company:
          service.company?.name ||
          service.company?.picture ||
          "Transportadora",
        price: Number(service.custom_price || service.price || 0),
        deliveryTime: Number(
          service.custom_delivery_time || service.delivery_time || 0,
        ),
        packages: service.packages || [],
      }))
      .filter((service) => service.price > 0)
      .sort((a, b) => a.price - b.price);

    res.status(200).json({ ok: true, services });
  } catch (error) {
    sendError(res, error);
  }
}
