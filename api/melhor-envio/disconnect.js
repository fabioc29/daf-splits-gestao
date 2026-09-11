import {
  clearSession,
  onlyMethod,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST")) return;
  clearSession(res);
  res.status(200).json({ ok: true });
}
