const API_BASE = "https://mandabem.com.br/ws";

function credentials() {
  return {
    plataforma_id: String(process.env.MANDA_BEM_PLATAFORMA_ID || "").trim(),
    plataforma_chave: String(process.env.MANDA_BEM_PLATAFORMA_CHAVE || "").trim(),
  };
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function appendIf(params, key, value) {
  if (value === undefined || value === null || value === "") return;
  params.append(key, String(value));
}

function buildParams(values = {}) {
  const creds = credentials();
  const params = new URLSearchParams();
  params.append("plataforma_id", creds.plataforma_id);
  params.append("plataforma_chave", creds.plataforma_chave);

  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) return;
    appendIf(params, key, value);
  });

  if (Array.isArray(values.produtos)) {
    values.produtos.forEach((product, index) => {
      appendIf(params, `produtos[${index}][nome]`, product?.nome);
      appendIf(params, `produtos[${index}][quantidade]`, product?.quantidade);
      appendIf(params, `produtos[${index}][preco]`, product?.preco);
    });
  }

  return params;
}

async function callMandaBem(endpoint, values) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
    },
    body: buildParams(values).toString(),
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const error = new Error("A MandaBem retornou um erro na requisição.");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function configured() {
  const creds = credentials();
  return Boolean(creds.plataforma_id && creds.plataforma_chave);
}

function normalizeService(value) {
  const service = String(value || "").trim().toUpperCase();
  const aliases = {
    "CORREIOS SEDEX": "SEDEX",
    "CORREIOS PAC": "PAC",
    "CORREIOS MINI": "PACMINI",
    "MINI ENVIOS": "PACMINI",
    "ENVIO MINI": "PACMINI",
  };
  return aliases[service] || service;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const action = String(req.query?.action || req.body?.action || "status");

  if (action === "status") {
    res.status(200).json({
      configured: configured(),
      originCep: String(process.env.MANDA_BEM_CEP_ORIGEM || "").replace(/\D/g, ""),
      capabilities: {
        quote: true,
        generate: true,
        shipment: true,
        shipments: true,
        cep: true,
        reverse: true,
        balanceRecharge: false,
      },
    });
    return;
  }

  if (!configured()) {
    res.status(503).json({
      error: "Integração MandaBem ainda não configurada.",
      code: "MANDA_BEM_NOT_CONFIGURED",
    });
    return;
  }

  try {
    const body = req.body || {};
    let result;

    if (action === "quote") {
      result = await callMandaBem("valor_envio", {
        cep_origem:
          onlyDigits(body.cep_origem) ||
          onlyDigits(process.env.MANDA_BEM_CEP_ORIGEM),
        cep_destino: onlyDigits(body.cep_destino),
        valor_seguro: body.valor_seguro,
        servico: normalizeService(body.servico),
        peso: body.peso,
        altura: body.altura,
        largura: body.largura,
        comprimento: body.comprimento,
      });
    } else if (action === "generate") {
      result = await callMandaBem("gerar_envio", {
        forma_envio: normalizeService(body.forma_envio),
        destinatario: String(body.destinatario || "").slice(0, 40),
        cep: onlyDigits(body.cep),
        logradouro: String(body.logradouro || "").slice(0, 60),
        numero: String(body.numero || "").slice(0, 6),
        complemento: String(body.complemento || "").slice(0, 30),
        cidade: String(body.cidade || "").slice(0, 40),
        bairro: String(body.bairro || "").slice(0, 60),
        estado: String(body.estado || "").slice(0, 2).toUpperCase(),
        peso: body.peso,
        altura: body.altura,
        largura: body.largura,
        comprimento: body.comprimento,
        cpf_destinatario: onlyDigits(body.cpf_destinatario),
        valor_seguro: body.valor_seguro,
        ref_id: body.ref_id,
        integration: String(body.integration || "DAF Splits").slice(0, 20),
        email: body.email,
        cep_origem:
          onlyDigits(body.cep_origem) ||
          onlyDigits(process.env.MANDA_BEM_CEP_ORIGEM),
        produtos: body.produtos,
      });
    } else if (action === "shipment") {
      result = await callMandaBem("envio", {
        id: body.id,
        ref_id: body.ref_id,
      });
    } else if (action === "shipments") {
      result = await callMandaBem("envios", {
        start_date: body.start_date,
        end_date: body.end_date,
      });
    } else if (action === "cep") {
      result = await callMandaBem("consulta_cep", {
        cep: onlyDigits(body.cep),
      });
    } else if (action === "reverse") {
      result = await callMandaBem("gerar_reversa", {
        forma_envio: normalizeService(body.forma_envio),
        remetente: String(body.remetente || "").slice(0, 40),
        cep: onlyDigits(body.cep),
        logradouro: String(body.logradouro || "").slice(0, 60),
        numero: String(body.numero || "").slice(0, 6),
        complemento: String(body.complemento || "").slice(0, 20),
        cidade: String(body.cidade || "").slice(0, 40),
        bairro: String(body.bairro || "").slice(0, 60),
        estado: String(body.estado || "").slice(0, 2).toUpperCase(),
        peso: body.peso,
        altura: body.altura,
        largura: body.largura,
        comprimento: body.comprimento,
        valor_seguro: body.valor_seguro,
        email: body.email,
      });
    } else {
      res.status(400).json({ error: "Ação MandaBem inválida." });
      return;
    }

    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    res.status(error?.status || 502).json({
      error: error?.message || "Falha ao comunicar com a MandaBem.",
      details: error?.details || null,
    });
  }
}
