import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, ArrowRight, Calculator, Filter, Layers, FileJson, ArrowUpDown, Scissors, TrendingUp } from "lucide-react";
import { NodeData } from "@/lib/flow-utils";
import * as XLSX from "xlsx";

// --- Helpers ---
const NodeHeader = ({ icon: Icon, title, color }: { icon: any, title: string, color: string }) => (
  <div className={`flex items-center gap-2 px-4 py-2 border-b border-border ${color} rounded-t-lg`}>
    <Icon className="w-4 h-4 text-white" />
    <span className="text-sm font-semibold text-white">{title}</span>
  </div>
);

const ErrorDisplay = ({ error }: { error?: string }) => {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
      <AlertCircle className="w-3 h-3" />
      {error}
    </div>
  );
};

// --- Nodes ---

export const InputNode = memo(({ data, id }: NodeProps<NodeData>) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // In React Flow, we typically update node data via a custom hook or context in the parent
    // For this implementation, we rely on the parent updating `nodes` state or direct mutation if simplified
    // This assumes the parent passes a specialized `updateNodeData` callback or we use `useReactFlow`
    // For MVP, we'll attach the handler in the FlowEditor page or use a simple hack:
    data.json = e.target.value; 
    // Ideally use useReactFlow().setNodes(...)
  };

  return (
    <Card className="w-[300px] border-l-4 border-l-blue-500 bg-card">
      <NodeHeader icon={FileJson} title="JSON Input" color="bg-blue-500" />
      <CardContent className="p-3">
        <Label className="text-xs text-muted-foreground mb-1 block">Raw JSON Data</Label>
        <Textarea 
          className="font-mono text-xs h-[150px] bg-secondary/50 border-0 resize-none"
          defaultValue={data.json}
          placeholder='[{"id": 1, "value": 100}, ...]'
          onChange={handleChange}
        />
        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    </Card>
  );
});

export const ExcelInputNode = memo(({ data }: NodeProps<NodeData>) => {
  const setField = (key: string, val: unknown) => {
    (data as any)[key] = val;
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    const base64 = btoa(binary);

    // Pre-read workbook to populate sheet picker (best-effort)
    try {
      const wb = XLSX.read(bytes, { type: "array" });
      setField("excelSheet", data.excelSheet ?? wb.SheetNames[0]);
    } catch {
      // If parsing fails here, engine will surface error on Run
    }

    setField("excelBase64", base64);
  };

  return (
    <Card className="w-[320px] border-l-4 border-l-emerald-600 bg-card">
      <NodeHeader icon={FileJson} title="Excel Input" color="bg-emerald-600" />
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Excel file (.xlsx)</Label>
          <Input
            className="h-7 text-xs"
            type="file"
            accept=".xlsx"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Sheet</Label>
            <Input
              className="h-7 text-xs"
              defaultValue={data.excelSheet}
              onChange={(e) => setField("excelSheet", e.target.value)}
              placeholder="Sheet1"
            />
          </div>
          <div>
            <Label className="text-xs">Header row</Label>
            <Select
              defaultValue={(data.excelHeaderRow ?? true) ? "true" : "false"}
              onValueChange={(v) => setField("excelHeaderRow", v === "true")}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>File</span>
          <Badge variant="secondary" className="text-[10px] h-5">
            {data.excelBase64 ? "loaded" : "none"}
          </Badge>
        </div>

        <ErrorDisplay error={data.error} />
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-emerald-600" />
    </Card>
  );
});

export const FilterNode = memo(({ data }: NodeProps<NodeData>) => {
  const updateField = (key: string, val: string) => { (data as any)[key] = val; };

  return (
    <Card className="w-[280px] border-l-4 border-l-purple-500 bg-card">
      <Handle type="target" position={Position.Left} className="!bg-purple-500" />
      <NodeHeader icon={Filter} title="Filter" color="bg-purple-500" />
      <CardContent className="p-3 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <div>
            <Label className="text-xs">Field</Label>
            <Input 
              className="h-7 text-xs" 
              defaultValue={data.field} 
              onChange={(e) => updateField('field', e.target.value)} 
              placeholder="e.g. status"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Operator</Label>
              <Select defaultValue={data.operator} onValueChange={(v) => updateField('operator', v)}>
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
              <Input 
                className="h-7 text-xs" 
                defaultValue={data.value} 
                onChange={(e) => updateField('value', e.target.value)} 
                placeholder="val"
              />
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>Processed</span>
          <Badge variant="secondary" className="text-[10px] h-5">{data.result?.length || 0} items</Badge>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-purple-500" />
    </Card>
  );
});

export const GroupNode = memo(({ data }: NodeProps<NodeData>) => {
  const updateField = (key: string, val: string) => { (data as any)[key] = val; };

  return (
    <Card className="w-[250px] border-l-4 border-l-orange-500 bg-card">
      <Handle type="target" position={Position.Left} className="!bg-orange-500" />
      <NodeHeader icon={Layers} title="Group By" color="bg-orange-500" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Group Field</Label>
          <Input 
            className="h-7 text-xs" 
            defaultValue={data.field} 
            onChange={(e) => updateField('field', e.target.value)} 
            placeholder="e.g. category"
          />
        </div>
        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>Groups</span>
          <Badge variant="secondary" className="text-[10px] h-5">{data.result?.length || 0}</Badge>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-orange-500" />
    </Card>
  );
});

export const StatsNode = memo(({ data }: NodeProps<NodeData>) => {
  const updateField = (key: string, val: string) => { (data as any)[key] = val; };

  return (
    <Card className="w-[250px] border-l-4 border-l-green-500 bg-card">
      <Handle type="target" position={Position.Left} className="!bg-green-500" />
      <NodeHeader icon={Calculator} title="Statistics" color="bg-green-500" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Field</Label>
          <Input 
            className="h-7 text-xs" 
            defaultValue={data.field} 
            onChange={(e) => updateField('field', e.target.value)} 
            placeholder="e.g. price"
          />
        </div>
        <div>
          <Label className="text-xs">Operation</Label>
          <Select defaultValue={data.operation} onValueChange={(v) => updateField('operation', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="sum">Sum</SelectItem>
              <SelectItem value="avg">Average</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-green-500" />
    </Card>
  );
});

export const ResultNode = memo(({ data }: NodeProps<NodeData>) => {
  const result = data.result || [];
  const first = result.length > 0 ? result[0] : undefined;
  const keys =
    first !== null && typeof first === "object"
      ? Object.keys(first as Record<string, unknown>).slice(0, 3)
      : [];

  return (
    <Card className="w-[350px] border-l-4 border-l-zinc-500 bg-card shadow-2xl">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <NodeHeader icon={ArrowRight} title="Result" color="bg-zinc-500" />
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] w-full bg-secondary/20">
          {result.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center italic">
              No data waiting...
            </div>
          ) : (
            <div className="text-xs font-mono p-2">
               {/* Simplified Table View */}
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-border">
                    {keys.map(k => <TableHead key={k} className="h-6 px-2">{k}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.slice(0, 10).map((row: any, i: number) => (
                    <TableRow key={i} className="hover:bg-muted/50 border-b-border/50">
                      {keys.map(k => (
                        <TableCell key={k} className="p-2 py-1 truncate max-w-[100px]">
                          {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {result.length > 10 && (
                <div className="p-2 text-center text-muted-foreground bg-secondary/50">
                  + {result.length - 10} more items
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <div className="bg-secondary/80 p-2 text-[10px] text-muted-foreground flex justify-between">
          <span>Preview Mode</span>
          <span>{result.length} Records</span>
        </div>
      </CardContent>
    </Card>
  );
});

export const SortNode = memo(({ data }: NodeProps<NodeData>) => {
  const updateField = (key: string, val: string) => {
    (data as any)[key] = val;
  };

  return (
    <Card className="w-[260px] border-l-4 border-l-cyan-600 bg-card">
      <Handle type="target" position={Position.Left} className="!bg-cyan-600" />
      <NodeHeader icon={ArrowUpDown} title="Sort" color="bg-cyan-600" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Field</Label>
          <Input
            className="h-7 text-xs"
            defaultValue={data.sortField}
            onChange={(e) => updateField("sortField", e.target.value)}
            placeholder="e.g. score"
          />
        </div>
        <div>
          <Label className="text-xs">Direction</Label>
          <Select
            defaultValue={data.sortDirection ?? "asc"}
            onValueChange={(v) => updateField("sortDirection", v)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>Rows</span>
          <Badge variant="secondary" className="text-[10px] h-5">{data.result?.length || 0}</Badge>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-cyan-600" />
    </Card>
  );
});

export const LimitNode = memo(({ data }: NodeProps<NodeData>) => {
  const updateLimit = (val: string) => {
    const n = Number(val);
    (data as any).limit = Number.isFinite(n) ? n : undefined;
  };

  return (
    <Card className="w-[240px] border-l-4 border-l-slate-600 bg-card">
      <Handle type="target" position={Position.Left} className="!bg-slate-600" />
      <NodeHeader icon={Scissors} title="Limit" color="bg-slate-600" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Max rows</Label>
          <Input
            className="h-7 text-xs"
            type="number"
            defaultValue={typeof data.limit === "number" ? data.limit : 10}
            onChange={(e) => updateLimit(e.target.value)}
            placeholder="10"
          />
        </div>
        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>Rows</span>
          <Badge variant="secondary" className="text-[10px] h-5">{data.result?.length || 0}</Badge>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-slate-600" />
    </Card>
  );
});

export const ExtremaNode = memo(({ data }: NodeProps<NodeData>) => {
  const updateField = (key: string, val: string) => {
    (data as any)[key] = val;
  };

  return (
    <Card className="w-[260px] border-l-4 border-l-rose-600 bg-card">
      <Handle type="target" position={Position.Left} className="!bg-rose-600" />
      <NodeHeader icon={TrendingUp} title="Min / Max" color="bg-rose-600" />
      <CardContent className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Field</Label>
          <Input
            className="h-7 text-xs"
            defaultValue={data.field}
            onChange={(e) => updateField("field", e.target.value)}
            placeholder="e.g. score"
          />
        </div>
        <div>
          <Label className="text-xs">Operation</Label>
          <Select
            defaultValue={data.extrema ?? "both"}
            onValueChange={(v) => updateField("extrema", v)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Min + Max</SelectItem>
              <SelectItem value="min">Min</SelectItem>
              <SelectItem value="max">Max</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2 mt-2">
          <span>Output rows</span>
          <Badge variant="secondary" className="text-[10px] h-5">{data.result?.length || 0}</Badge>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-rose-600" />
    </Card>
  );
});

export const nodeTypes = {
  inputNode: InputNode,
  excelInputNode: ExcelInputNode,
  filterNode: FilterNode,
  groupNode: GroupNode,
  statsNode: StatsNode,
  sortNode: SortNode,
  limitNode: LimitNode,
  extremaNode: ExtremaNode,
  resultNode: ResultNode,
};
