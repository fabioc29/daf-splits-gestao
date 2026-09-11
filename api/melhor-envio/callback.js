export default function handler(req, res) {
  const code = typeof req.query?.code === "string" ? req.query.code : "";
  const error = typeof req.query?.error === "string" ? req.query.error : "";

  res.setHeader("Cache-Control", "no-store");

  if (error) {
    res.status(400).send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>DAF Splits · Melhor Envio</title>
        </head>
        <body style="font-family:Arial,sans-serif;background:#0b1421;color:#fff;padding:40px">
          <h1>Não foi possível autorizar o Melhor Envio</h1>
          <p>Volte ao sistema DAF Splits e tente novamente.</p>
        </body>
      </html>
    `);
    return;
  }

  res.status(200).send(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>DAF Splits · Melhor Envio</title>
      </head>
      <body style="font-family:Arial,sans-serif;background:#0b1421;color:#fff;padding:40px">
        <h1>Callback do Melhor Envio configurado</h1>
        <p>${code ? "Autorização recebida. A integração será finalizada dentro do sistema DAF Splits." : "Esta URL está pronta para receber o redirecionamento OAuth do Melhor Envio."}</p>
      </body>
    </html>
  `);
}
