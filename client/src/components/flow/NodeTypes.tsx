import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, ArrowRight, ArrowUpDown, Calculator, Filter, FileJson, FileSpreadsheet,
  GitMerge, Hash, Layers, Scissors, TrendingUp,
} from "lucide-react";
import { NodeData } from "@/lib/flow-utils";
import { assertNodeTypesSynced } from "@shared/flow-engine";

// --- Helpers ---

/** Update one field of a node's data through React state (not by mutation). */
const useNodeField = (id: string) => {
  const { setNodes } = useReactFlow();
  return useCallback(
    (key: string, value: any) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n))
      );
    },
    [id, setNodes]
  );
};

const NodeHeader = ({ icon: Icon, title, color }: { icon: any; title: string; color: string }) => (
  <div className={`flex items-center gap-2 px-4 py-2 ${color} rounded-t-lg`}>
    <Icon className="w-4 h-4 text-white" />
    <span className="text-sm font-semibold text-white">{title}</span>
  </div>
);

const ErrorDisplay = ({ error }: { error?: string }) =>
  !error ? null : (
    <div className="flex items-center gap-2 mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span>{error}</span>
    </div>
  );

const ResultBadge = ({ result }: { result?: any }) => {
  let text = "—";
  if (typeof result === "number" || typeof result === "string") text = String(result);
  else if (Array.isArray(result)) text = `${result.length} rows`;
  else if (result && typeof result === "object") text = `${Object.keys(result).length} keys`;
  return <Badge variant="secondary" className="text-[10px] h-5">{text}</Badge>;
};

const Footer = ({ label, result }: { label: string; result?: any }) => (
  <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
    <span>{label}</span>
    <ResultBadge result={result} />
  </div>
);

const Inspect = ({ result }: { result?: any }) => {
  if (result === undefined || result === null || typeof result === "number" || typeof result === "string") return null;
  return (
    <details className="text-[10px]">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">inspect</summary>
      <pre className="mt-1 max-h-[120px] overflow-auto rounded bg-secondary/50 p-2 font-mono leading-4">
        {JSON.stringify(result, null, 1)}
      </pre>
    </details>
  );
};

// --- Sources ---

export const SourceNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[300px] border-l-4 border-l-blue-500 bg-card">
      <NodeHeader icon={FileJson} title="Source" color="bg-blue-500" />
      <CardContent className="p-3 space-y-2">
        <div>
          <Label className="text-xs">Dataset name</Label>
          <Input className="h-7 text-xs" defaultValue={data.dataset}
            onChange={(e) => set("dataset", e.target.value)} placeholder="e.g. score_inputs" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Sample JSON (preview)</Label>
          <Textarea className="font-mono text-xs h-[110px] bg-secondary/50 border-0 resize-none"
            defaultValue={data.json} placeholder='[{"type":"Tugas","score_eff":80,"w_peng":1}] or {"Tugas":25}'
            onChange={(e) => set("json", e.target.value)} />
        </div>
        <Footer label="Emits" result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    </Card>
  );
});

export const ExcelInputNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  const onFile = async (file: File | null) => {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    try {
      const wb = XLSX.read(bytes, { type: "array" });
      if (!data.excelSheet) set("excelSheet", wb.SheetNames[0]);
    } catch { /* engine surfaces parse errors on Run */ }
    set("excelBase64", btoa(binary));
  };
  return (
    <Card className="w-[320px] border-l-4 border-l-emerald-600 bg-card">
      <NodeHeader icon={FileSpreadsheet} title="Excel Input" color="bg-emerald-600" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Excel file (.xlsx)</Label>
          <Input className="h-7 text-xs" type="file" accept=".xlsx"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Sheet</Label>
            <Input className="h-7 text-xs" defaultValue={data.excelSheet}
              onChange={(e) => set("excelSheet", e.target.value)} placeholder="Sheet1" />
          </div>
          <div>
            <Label className="text-xs">Header row</Label>
            <Select defaultValue={(data.excelHeaderRow ?? true) ? "true" : "false"}
              onValueChange={(v) => set("excelHeaderRow", v === "true")}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>{data.excelBase64 ? "file loaded" : "no file"}</span>
          <ResultBadge result={data.result} />
        </div>
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-emerald-600" />
    </Card>
  );
});

// --- Collection ops ---

export const FilterNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[280px] border-l-4 border-l-purple-500 bg-card">
      <Handle type="target" position={Position.Left} id="rows" className="!bg-purple-500" />
      <NodeHeader icon={Filter} title="Filter" color="bg-purple-500" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Field</Label>
          <Input className="h-7 text-xs" defaultValue={data.field}
            onChange={(e) => set("field", e.target.value)} placeholder="e.g. type" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Operator</Label>
            <Select defaultValue={data.operator} onValueChange={(v) => set("operator", v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="==">==</SelectItem>
                <SelectItem value="!=">!=</SelectItem>
                <SelectItem value=">">&gt;</SelectItem>
                <SelectItem value="<">&lt;</SelectItem>
                <SelectItem value="contains">contains</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Value</Label>
            <Input className="h-7 text-xs" defaultValue={data.value}
              onChange={(e) => set("value", e.target.value)} placeholder="val" />
          </div>
        </div>
        <Footer label="Filtered" result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-purple-500" />
    </Card>
  );
});

export const SortNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[250px] border-l-4 border-l-cyan-600 bg-card">
      <Handle type="target" position={Position.Left} id="rows" className="!bg-cyan-600" />
      <NodeHeader icon={ArrowUpDown} title="Sort" color="bg-cyan-700" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Sort field</Label>
          <Input className="h-7 text-xs" defaultValue={data.sortField}
            onChange={(e) => set("sortField", e.target.value)} placeholder="e.g. score_eff" />
        </div>
        <div>
          <Label className="text-xs">Direction</Label>
          <Select defaultValue={data.sortDirection ?? "asc"} onValueChange={(v) => set("sortDirection", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Footer label="Sorted" result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-cyan-600" />
    </Card>
  );
});

export const LimitNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[200px] border-l-4 border-l-slate-500 bg-card">
      <Handle type="target" position={Position.Left} id="rows" className="!bg-slate-500" />
      <NodeHeader icon={Scissors} title="Limit" color="bg-slate-600" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Max rows</Label>
          <Input type="number" className="h-7 text-xs" defaultValue={data.limit as any}
            onChange={(e) => set("limit", Number(e.target.value))} placeholder="10" />
        </div>
        <Footer label="Kept" result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </Card>
  );
});

export const GroupByNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[250px] border-l-4 border-l-orange-500 bg-card">
      <Handle type="target" position={Position.Left} id="rows" className="!bg-orange-500" />
      <NodeHeader icon={Layers} title="Group By" color="bg-orange-500" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Group field</Label>
          <Input className="h-7 text-xs" defaultValue={data.field}
            onChange={(e) => set("field", e.target.value)} placeholder="e.g. type" />
        </div>
        <Footer label="Groups" result={data.result} />
        <Inspect result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-orange-500" />
    </Card>
  );
});

export const AggregateGroupsNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[250px] border-l-4 border-l-green-500 bg-card">
      <Handle type="target" position={Position.Left} id="groups" className="!bg-green-500" />
      <NodeHeader icon={Calculator} title="Aggregate Groups" color="bg-green-500" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Operation</Label>
          <Select defaultValue={data.op} onValueChange={(v) => set("op", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weighted_average">Weighted average</SelectItem>
              <SelectItem value="weighted_sum">Weighted sum</SelectItem>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="sum">Sum</SelectItem>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="min">Min</SelectItem>
              <SelectItem value="max">Max</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Value field</Label>
            <Input className="h-7 text-xs" defaultValue={data.value as any}
              onChange={(e) => set("value", e.target.value)} placeholder="score_eff" />
          </div>
          <div>
            <Label className="text-xs">Weight field</Label>
            <Input className="h-7 text-xs" defaultValue={data.weight}
              onChange={(e) => set("weight", e.target.value)} placeholder="w_peng" />
          </div>
        </div>
        <div>
          <Label className="text-xs">On empty</Label>
          <Input className="h-7 text-xs" defaultValue={data.onEmpty}
            onChange={(e) => set("onEmpty", e.target.value)} placeholder="drop or a number" />
        </div>
        <Footer label="Per-group" result={data.result} />
        <Inspect result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-green-500" />
    </Card>
  );
});

export const ExtremaNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[230px] border-l-4 border-l-rose-500 bg-card">
      <Handle type="target" position={Position.Left} id="rows" className="!bg-rose-500" />
      <NodeHeader icon={TrendingUp} title="Min / Max" color="bg-rose-600" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Field</Label>
          <Input className="h-7 text-xs" defaultValue={data.field}
            onChange={(e) => set("field", e.target.value)} placeholder="e.g. score_eff" />
        </div>
        <div>
          <Label className="text-xs">Mode</Label>
          <Select defaultValue={data.extrema ?? "both"} onValueChange={(v) => set("extrema", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Min &amp; Max</SelectItem>
              <SelectItem value="min">Min</SelectItem>
              <SelectItem value="max">Max</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Footer label="Result" result={data.result} />
        <Inspect result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-rose-500" />
    </Card>
  );
});

// --- Combine / scalar ---

export const CombineByKeyNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[260px] border-l-4 border-l-cyan-500 bg-card">
      <Handle type="target" position={Position.Left} id="values" style={{ top: 78 }} className="!bg-cyan-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} id="weights" style={{ top: 104 }} className="!bg-cyan-300 !w-3 !h-3" />
      <NodeHeader icon={GitMerge} title="Combine by Key" color="bg-cyan-600" />
      <CardContent className="p-3 space-y-2">
        <div className="text-[10px] leading-[26px] border rounded px-2">
          <div className="text-cyan-500">● <b>values</b> <span className="text-muted-foreground">(top handle)</span></div>
          <div className="text-cyan-300">● <b>weights</b> <span className="text-muted-foreground">(bottom handle)</span></div>
        </div>
        <div>
          <Label className="text-xs">Operation</Label>
          <Select defaultValue={data.op} onValueChange={(v) => set("op", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weighted_average">Weighted average</SelectItem>
              <SelectItem value="weighted_sum">Weighted sum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Footer label="Result" result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-cyan-500" />
    </Card>
  );
});

export const RoundNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[200px] border-l-4 border-l-indigo-500 bg-card">
      <Handle type="target" position={Position.Left} id="value" className="!bg-indigo-500" />
      <NodeHeader icon={Hash} title="Round" color="bg-indigo-500" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Precision</Label>
          <Input type="number" className="h-7 text-xs" defaultValue={data.precision as any}
            onChange={(e) => set("precision", e.target.value)} placeholder="2" />
        </div>
        <Footer label="Value" result={data.result} />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </Card>
  );
});

export const OutputNode = memo(({ id, data }: NodeProps<NodeData>) => {
  const set = useNodeField(id);
  return (
    <Card className="w-[240px] border-l-4 border-l-zinc-500 bg-card shadow-2xl">
      <Handle type="target" position={Position.Left} id="value" className="!bg-zinc-500" />
      <NodeHeader icon={ArrowRight} title="Output" color="bg-zinc-600" />
      <CardContent className="p-3 space-y-2">
        <div>
          <Label className="text-xs">Variable name</Label>
          <Input className="h-7 text-xs" defaultValue={data.name}
            onChange={(e) => set("name", e.target.value)} placeholder="kog_score" />
        </div>
        <div className="rounded bg-secondary/40 p-3 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{data.name || "result"}</div>
          <div className="text-2xl font-mono font-semibold">
            {typeof data.result === "number" || typeof data.result === "string"
              ? String(data.result)
              : data.result
              ? JSON.stringify(data.result)
              : "—"}
          </div>
        </div>
        <ErrorDisplay error={data.error} />
      </CardContent>
    </Card>
  );
});

export const nodeTypes = {
  source: SourceNode,
  excel_input: ExcelInputNode,
  filter: FilterNode,
  sort: SortNode,
  limit: LimitNode,
  group_by: GroupByNode,
  aggregate_groups: AggregateGroupsNode,
  extrema: ExtremaNode,
  combine_by_key: CombineByKeyNode,
  round: RoundNode,
  output: OutputNode,
};

// Keep client React registry aligned with shared/flow-engine (server run API).
assertNodeTypesSynced(nodeTypes, "client NodeTypes");
