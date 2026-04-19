import { db } from "./db";
import {
  flows,
  type Flow,
  type InsertFlow,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getFlows(): Promise<Flow[]>;
  getFlow(id: number): Promise<Flow | undefined>;
  /** All flows with this exact name (may be 0, 1, or many rows). */
  getFlowsByName(name: string): Promise<Flow[]>;
  createFlow(flow: InsertFlow): Promise<Flow>;
  updateFlow(id: number, updates: Partial<InsertFlow>): Promise<Flow>;
  deleteFlow(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getFlows(): Promise<Flow[]> {
    return await db.select().from(flows);
  }

  async getFlow(id: number): Promise<Flow | undefined> {
    const [flow] = await db.select().from(flows).where(eq(flows.id, id));
    return flow;
  }

  async getFlowsByName(name: string): Promise<Flow[]> {
    return await db.select().from(flows).where(eq(flows.name, name));
  }

  async createFlow(flow: InsertFlow): Promise<Flow> {
    const [created] = await db.insert(flows).values(flow).returning();
    return created;
  }

  async updateFlow(id: number, updates: Partial<InsertFlow>): Promise<Flow> {
    const [updated] = await db
      .update(flows)
      .set(updates)
      .where(eq(flows.id, id))
      .returning();
    return updated;
  }

  async deleteFlow(id: number): Promise<void> {
    await db.delete(flows).where(eq(flows.id, id));
  }
}

export const storage = new DatabaseStorage();
