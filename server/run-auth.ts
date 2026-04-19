import type { Request, Response, NextFunction } from "express";

/**
 * When `FLOW_RUN_API_KEY` is set, `POST` flow run endpoints require either:
 * - `Authorization: Bearer <key>`
 * - `X-API-Key: <key>`
 *
 * When unset, run endpoints stay open (local development).
 */
export function requireFlowRunApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = process.env.FLOW_RUN_API_KEY?.trim();
  if (!key) {
    next();
    return;
  }

  const auth = req.headers.authorization;
  const bearer =
    typeof auth === "string" ? /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() : undefined;
  const raw = req.headers["x-api-key"];
  const xApiKey = Array.isArray(raw) ? raw[0] : raw;

  if (bearer === key || (typeof xApiKey === "string" && xApiKey === key)) {
    next();
    return;
  }

  res.status(401).json({ message: "Unauthorized" });
}
