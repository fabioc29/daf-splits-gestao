import {
  melhorEnvioFetch,
  onlyMethod,
  sendError,
} from "./_lib.js";

const digits = (value) => String(value || "").replace(/\D/g, "");
const numeric = (value) => Number(String(value ?? "").replace(",", "."));

function assertField(value, label) {
  if (!String(value || "").trim()) {
    const error = new Error(`Informe ${label} antes de gerar a etiqueta.`);
    error.status = 400;
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicPrintUrl(data) {
  return (
    data?.url ||
    data?.link ||
    data?.data?.url ||
    data?.data?.link ||
    ""
  );
}

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST")) return;
  try {
    const body = req.body || {};
    if (body.confirmPurchase !== true) {
      res.status(400).json({
        ok: false,
        error:
          "A compra da etiqueta precisa ser confirmada explicitamente antes do checkout.",
      });
      return;
    }

    const service = Number(body.service);
    const from = body.from || {};
    const to = body.to || {};
    const volume = body.volume || {};
    const products = Array.isArray(body.products) ? body.products : [];
    const orderNumber = String(body.orderNumber || "").trim();

    if (!service) {
      const error = new Error("Selecione um serviço de envio.");
      error.status = 400;
      throw error;
    }

    for (const [value, label] of [
      [from.name, "o nome do remetente"],
      [from.email, "o e-mail do remetente"],
      [from.phone, "o telefone do remetente"],
      [from.document, "o CPF do remetente"],
      [from.address, "o endereço do remetente"],
      [from.number, "o número do remetente"],
      [from.district, "o bairro do remetente"],
      [from.city, "a cidade do remetente"],
      [from.state_abbr, "o estado do remetente"],
      [from.postal_code, "o CEP do remetente"],
      [to.name, "o nome do destinatário"],
      [to.email, "o e-mail do destinatário"],
      [to.phone, "o telefone do destinatário"],
      [to.document, "o CPF do destinatário"],
      [to.address, "o endereço do destinatário"],
      [to.number, "o número do destinatário"],
      [to.district, "o bairro do destinatário"],
      [to.city, "a cidade do destinatário"],
      [to.state_abbr, "o estado do destinatário"],
      [to.postal_code, "o CEP do destinatário"],
    ]) {
      assertField(value, label);
    }

    const normalizedProducts = products
      .map((product) => ({
        name: String(product.name || "").trim(),
        quantity: Math.max(1, Number(product.quantity || 1)),
        unitary_value: Math.max(0.01, numeric(product.unitary_value)),
      }))
      .filter((product) => product.name);

    if (!normalizedProducts.length) {
      const error = new Error(
        "Informe os produtos e os valores da declaração de conteúdo.",
      );
      error.status = 400;
      throw error;
    }

    const normalizedVolume = {
      height: numeric(volume.height),
      width: numeric(volume.width),
      length: numeric(volume.length),
      weight: numeric(volume.weight),
    };
    if (
      !normalizedVolume.height ||
      !normalizedVolume.width ||
      !normalizedVolume.length ||
      !normalizedVolume.weight
    ) {
      const error = new Error("Informe dimensões e peso válidos.");
      error.status = 400;
      throw error;
    }

    const insuranceValue = normalizedProducts.reduce(
      (sum, product) =>
        sum + product.quantity * product.unitary_value,
      0,
    );

    const cartPayload = {
      service,
      from: {
        name: String(from.name).trim(),
        email: String(from.email).trim(),
        phone: digits(from.phone),
        document: digits(from.document),
        state_register: "ISENTO",
        address: String(from.address).trim(),
        complement: String(from.complement || "").trim(),
        number: String(from.number).trim(),
        district: String(from.district).trim(),
        city: String(from.city).trim(),
        postal_code: digits(from.postal_code),
        state_abbr: String(from.state_abbr).trim().toUpperCase(),
      },
      to: {
        name: String(to.name).trim(),
        email: String(to.email).trim(),
        phone: digits(to.phone),
        document: digits(to.document),
        state_register: "ISENTO",
        address: String(to.address).trim(),
        complement: String(to.complement || "").trim(),
        number: String(to.number).trim(),
        district: String(to.district).trim(),
        city: String(to.city).trim(),
        postal_code: digits(to.postal_code),
        country_id: "BR",
        state_abbr: String(to.state_abbr).trim().toUpperCase(),
      },
      products: normalizedProducts,
      volumes: [normalizedVolume],
      options: {
        platform: "DAF Splits",
        reminder: orderNumber ? `Pedido DAF #${orderNumber}` : "Pedido DAF Splits",
        insurance_value: Number(insuranceValue.toFixed(2)),
        receipt: false,
        own_hand: false,
        reverse: false,
        tags: [
          {
            tag: orderNumber ? `DAF #${orderNumber}` : "DAF Splits",
            url: null,
          },
        ],
      },
    };

    const cart = await melhorEnvioFetch(req, res, "/api/v2/me/cart", {
      method: "POST",
      body: cartPayload,
    });
    const orderId = cart?.id || cart?.order?.id;
    if (!orderId) {
      const error = new Error(
        "O Melhor Envio não retornou o ID da etiqueta criada no carrinho.",
      );
      error.status = 502;
      error.details = cart;
      throw error;
    }

    const checkout = await melhorEnvioFetch(
      req,
      res,
      "/api/v2/me/shipment/checkout",
      {
        method: "POST",
        body: { orders: [orderId] },
      },
    );

    await melhorEnvioFetch(req, res, "/api/v2/me/shipment/generate", {
      method: "POST",
      body: { orders: [orderId] },
    });

    let print = null;
    let lastPrintError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await sleep(attempt === 0 ? 1200 : 1800);
      try {
        print = await melhorEnvioFetch(
          req,
          res,
          "/api/v2/me/shipment/print",
          {
            method: "POST",
            body: { mode: "public", orders: [orderId] },
          },
        );
        if (publicPrintUrl(print)) break;
      } catch (error) {
        lastPrintError = error;
      }
    }

    const order = await melhorEnvioFetch(
      req,
      res,
      `/api/v2/me/orders/${encodeURIComponent(orderId)}`,
    ).catch(() => null);

    const printUrl = publicPrintUrl(print);
    if (!printUrl && lastPrintError) {
      res.status(202).json({
        ok: true,
        pendingPrint: true,
        orderId,
        checkout,
        order,
        warning:
          "A etiqueta foi comprada e gerada, mas o link de impressão ainda está sendo processado.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      orderId,
      printUrl,
      tracking:
        order?.tracking ||
        order?.tracking_code ||
        order?.protocol ||
        "",
      price: Number(cart?.price || cart?.custom_price || 0),
      service: cart?.service || service,
      order,
    });
  } catch (error) {
    sendError(res, error);
  }
}
