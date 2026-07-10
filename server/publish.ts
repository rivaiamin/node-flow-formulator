/**
 * Server-to-server publish: forward a flow to a tenant's AIMSIS instance.
 *
 * The browser never sees the AIMSIS token — it POSTs to this editor server, which
 * forwards to AIMSIS's token-authed `reportcalculationapi/publish` endpoint. Set:
 *   AIMSIS_PUBLISH_URL   e.g. https://<school>.ac.aimsis.com/reportcalculationapi/publish
 *   AIMSIS_PUBLISH_TOKEN shared secret; must match AIMSIS's REPORTCALC_PUBLISH_TOKEN
 * When either is unset, publishing is disabled (503) — nothing is exposed.
 */

export interface PublishInput {
  name: string;
  flowData: { nodes: unknown[]; edges: unknown[] };
  id?: number;
  label?: string;
}

export interface PublishResult {
  status: number;
  body: unknown;
}

export async function publishToAimsis(input: PublishInput): Promise<PublishResult> {
  const url = process.env.AIMSIS_PUBLISH_URL?.trim();
  const token = process.env.AIMSIS_PUBLISH_TOKEN?.trim();
  if (!url || !token) {
    return {
      status: 503,
      body: { message: "Publishing is not configured (set AIMSIS_PUBLISH_URL and AIMSIS_PUBLISH_TOKEN)." },
    };
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: input.name,
        label: input.label,
        id: input.id,
        flow_data: input.flowData, // AIMSIS ReactflowAdapter expects { nodes, edges }
      }),
    });
  } catch (e) {
    return { status: 502, body: { message: `Could not reach AIMSIS: ${(e as Error).message}` } };
  }

  const text = await resp.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 300) || `AIMSIS returned ${resp.status}` };
  }
  return { status: resp.status, body };
}
