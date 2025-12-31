import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

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
      return res.status(404).json({ message: 'Flow not found' });
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
      if (!flow) return res.status(404).json({ message: 'Flow not found' });
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

  return httpServer;
}
