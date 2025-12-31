import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const flows = pgTable("flows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  flowData: jsonb("flow_data").notNull(), // Stores nodes and edges
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlowSchema = createInsertSchema(flows).omit({ id: true, createdAt: true });

export type Flow = typeof flows.$inferSelect;
export type InsertFlow = z.infer<typeof insertFlowSchema>;
