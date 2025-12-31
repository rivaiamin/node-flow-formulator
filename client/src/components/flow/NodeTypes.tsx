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
import { AlertCircle, ArrowRight, Calculator, Filter, Layers, FileJson } from "lucide-react";
import { NodeData } from "@/lib/flow-utils";

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
  const keys = result.length > 0 ? Object.keys(result[0]).slice(0, 3) : [];

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

export const nodeTypes = {
  inputNode: InputNode,
  filterNode: FilterNode,
  groupNode: GroupNode,
  statsNode: StatsNode,
  resultNode: ResultNode,
};
