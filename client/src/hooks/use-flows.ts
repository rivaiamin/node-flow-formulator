import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertFlow } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useFlows() {
  return useQuery({
    queryKey: [api.flows.list.path],
    queryFn: async () => {
      const res = await fetch(api.flows.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch flows");
      return api.flows.list.responses[200].parse(await res.json());
    },
  });
}

export function useFlow(id: number) {
  return useQuery({
    queryKey: [api.flows.get.path, id],
    queryFn: async () => {
      if (isNaN(id)) return null;
      const url = buildUrl(api.flows.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch flow");
      return api.flows.get.responses[200].parse(await res.json());
    },
    enabled: !isNaN(id),
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertFlow) => {
      const validated = api.flows.create.input.parse(data);
      const res = await fetch(api.flows.create.path, {
        method: api.flows.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.flows.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create flow");
      }
      return api.flows.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.flows.list.path] });
      toast({ title: "Flow created", description: "Start building your pipeline." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertFlow>) => {
      const validated = api.flows.update.input.parse(updates);
      const url = buildUrl(api.flows.update.path, { id });
      
      const res = await fetch(url, {
        method: api.flows.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update flow");
      return api.flows.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.flows.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.flows.get.path, data.id] });
      toast({ title: "Saved", description: "Flow changes saved successfully." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.flows.delete.path, { id });
      const res = await fetch(url, { 
        method: api.flows.delete.method, 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete flow");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.flows.list.path] });
      toast({ title: "Deleted", description: "Flow has been removed." });
    },
  });
}
