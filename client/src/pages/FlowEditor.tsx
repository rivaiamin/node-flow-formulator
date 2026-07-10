import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRoute } from "wouter";
import { Link } from "wouter";
import { FlowSidebar } from '@/components/flow/FlowSidebar';
import { nodeTypes } from '@/components/flow/NodeTypes';
import { processFlow, NODE_PORTS, portsCompatible } from '@/lib/flow-utils';
import { kogScoreExample } from '@/lib/example-flows';
import { useFlow, useUpdateFlow, useCreateFlow } from '@/hooks/use-flows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Play, Save, ChevronLeft, LayoutDashboard, Sparkles, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

let id = 0;
const getId = () => `dndnode_${id++}`;

function EditorContent() {
  const [match, params] = useRoute("/editor/:id");
  const flowId = params?.id ? parseInt(params.id) : undefined;
  const isNew = !flowId;

  const { data: flowData, isLoading } = useFlow(flowId || 0);
  const createMutation = useCreateFlow();
  const updateMutation = useUpdateFlow();
  const { toast } = useToast();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [flowName, setFlowName] = useState("Untitled Flow");
  const [publishing, setPublishing] = useState(false);

  // Load initial data
  useEffect(() => {
    if (flowData) {
      setFlowName(flowData.name);
      const parsed = flowData.flowData as { nodes: Node[], edges: Edge[] };
      if (parsed) {
        setNodes(parsed.nodes || []);
        setEdges(parsed.edges || []);
      }
    }
  }, [flowData, setNodes, setEdges]);

  const slotOf = (c: Connection | Edge) => c.targetHandle || 'value';

  // A slot takes exactly one source: connecting again replaces the old edge.
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          params,
          eds.filter((e) => !(e.target === params.target && slotOf(e) === slotOf(params)))
        )
      ),
    [setEdges]
  );

  // Reject wiring that the engine could never evaluate (e.g. a Grouped into a scalar input).
  const isValidConnection = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return false;
      const src = nodes.find((n) => n.id === c.source);
      const tgt = nodes.find((n) => n.id === c.target);
      if (!src?.type || !tgt?.type) return false;
      const sp = NODE_PORTS[src.type];
      const tp = NODE_PORTS[tgt.type];
      if (!sp || !tp) return false;
      const inType = tp.in[slotOf(c)];
      if (!inType) return false;
      return portsCompatible(sp.out, inType);
    },
    [nodes]
  );

  const loadExample = useCallback(() => {
    setNodes(kogScoreExample.nodes as Node[]);
    setEdges(kogScoreExample.edges as Edge[]);
    setFlowName('kog_score (example)');
    // fitView only runs on mount, so re-fit once the example nodes are laid out
    setTimeout(() => reactFlowInstance?.fitView({ padding: 0.12 }), 60);
    toast({ title: 'Example loaded', description: 'Hit Run Flow — expect kog_score = 79.06' });
  }, [setNodes, setEdges, toast, reactFlowInstance]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleRun = useCallback(() => {
    if (!nodes.length) return;
    const processedNodes = processFlow(nodes, edges);
    setNodes(processedNodes);
    toast({ title: "Flow Executed", description: "Data has propagated through the nodes." });
  }, [nodes, edges, setNodes, toast]);

  const handleSave = async () => {
    // Strip result data before saving to keep DB clean
    const cleanNodes = nodes.map(n => ({
      ...n,
      data: { ...n.data, result: undefined, error: undefined }
    }));

    const flowPayload = {
      name: flowName,
      flowData: { nodes: cleanNodes, edges },
    };

    if (isNew) {
      const newFlow = await createMutation.mutateAsync(flowPayload);
      window.history.pushState(null, '', `/editor/${newFlow.id}`);
      // Simple reload to sync state fully or better use wouter navigate, 
      // but pushState is fine for now to avoid full reload
    } else {
      await updateMutation.mutateAsync({ id: flowId, ...flowPayload });
    }
  };

  // Publish the current canvas to AIMSIS (via our own server, which holds the token).
  const handlePublish = async () => {
    if (!flowName.trim()) {
      toast({ title: "Name required", description: "Give the flow a name before publishing.", variant: "destructive" });
      return;
    }
    const cleanNodes = nodes.map(n => ({ ...n, data: { ...n.data, result: undefined, error: undefined } }));
    setPublishing(true);
    try {
      const res = await fetch("/api/flows/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flowName, flowData: { nodes: cleanNodes, edges } }),
      });
      const body = await res.json().catch(() => ({} as any));
      if (res.ok) {
        toast({ title: "Published to AIMSIS", description: `calculation_graph id ${body.id ?? "?"}` });
      } else {
        toast({
          title: "Publish failed",
          description: body.message || body.error || `HTTP ${res.status}`,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header Toolbar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-primary" />
            <Input 
              value={flowName} 
              onChange={e => setFlowName(e.target.value)} 
              className="h-8 w-[200px] bg-transparent border-transparent hover:border-border focus:border-primary font-semibold text-lg" 
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadExample}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Load example
          </Button>
          <Button
            onClick={handleRun}
            variant="outline"
            size="sm"
            className="border-primary/20 hover:bg-primary/10 text-primary"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Flow
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            size="sm"
            className="bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {!isSaving && <Save className="w-4 h-4 mr-2" />}
            Save Flow
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing}
            variant="outline"
            size="sm"
            className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
          >
            {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
            Publish to AIMSIS
          </Button>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        <FlowSidebar />
        
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-secondary/10"
          >
            <Background color="#444" gap={16} size={1} />
            <Controls className="bg-card border-border fill-foreground text-foreground" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  );
}
