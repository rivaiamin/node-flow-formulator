import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { requireFlowRunApiKey } from "./run-auth";
import { sendFlowRunResult } from "./run-flow";
import { publishToAimsis } from "./publish";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Flows API
  app.get(api.flows.list.path, async (req, res) => {
    const flows = await storage.getFlows();
    res.json(flows);
  });

  app.get(api.flows.get.path, async (req, res) => {
    const flow = await storage.getFlow(Number(req.params.id));
    if (!flow) {
      return res.status(404).json({ message: "Flow not found" });
    }
    res.json(flow);
  });

  app.post(api.flows.create.path, async (req, res) => {
    try {
      const input = api.flows.create.input.parse(req.body);
      const flow = await storage.createFlow(input);
      res.status(201).json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      throw err;
    }
  });

  app.put(api.flows.update.path, async (req, res) => {
    try {
      const input = api.flows.update.input.parse(req.body);
      const flow = await storage.updateFlow(Number(req.params.id), input);
      if (!flow) return res.status(404).json({ message: "Flow not found" });
      res.json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      throw err;
    }
  });

  app.delete(api.flows.delete.path, async (req, res) => {
    await storage.deleteFlow(Number(req.params.id));
    res.status(204).send();
  });

  // Publish a flow to a tenant's AIMSIS instance (server-to-server; token stays server-side).
  app.post(api.flows.publish.path, async (req, res) => {
    let body: z.infer<typeof api.flows.publish.input>;
    try {
      body = api.flows.publish.input.parse(req.body ?? {});
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid body" });
      }
      throw err;
    }
    const { status, body: out } = await publishToAimsis(body);
    res.status(status).json(out);
  });

  // Run by unique name (register before /api/flows/:id/run so paths stay unambiguous)
  app.post(
    api.flows.runByName.path,
    requireFlowRunApiKey,
    async (req, res) => {
      let body: z.infer<typeof api.flows.runByName.input>;
      try {
        body = api.flows.runByName.input.parse(req.body ?? {});
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: err.errors[0]?.message ?? "Invalid body" });
        }
        throw err;
      }

      const matches = await storage.getFlowsByName(body.flowName.trim());
      if (matches.length === 0) {
        return res.status(404).json({ message: "Flow not found" });
      }
      if (matches.length > 1) {
        return res.status(409).json({
          message:
            "Multiple flows use this name; resolve the ambiguity or use POST /api/flows/:id/run with a specific id.",
        });
      }

      const flow = matches[0]!;
      sendFlowRunResult(
        res,
        flow,
        { input: body.input, datasets: body.datasets },
        { includeFlowId: true }
      );
    }
  );

  app.post(
    api.flows.run.path,
    requireFlowRunApiKey,
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid flow id" });
      }

      let body: z.infer<typeof api.flows.run.input>;
      try {
        body = api.flows.run.input.parse(req.body ?? {});
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: err.errors[0]?.message ?? "Invalid body" });
        }
        throw err;
      }

      const flow = await storage.getFlow(id);
      if (!flow) {
        return res.status(404).json({ message: "Flow not found" });
      }

      sendFlowRunResult(res, flow, {
        input: body.input,
        datasets: body.datasets,
      });
    }
  );

  return httpServer;
}
