import { DragEvent } from 'react';
import { Card } from "@/components/ui/card";
import { FileJson, Filter, Layers, Calculator, ArrowRight, ArrowUpDown, Scissors, TrendingUp } from "lucide-react";

const DraggableNode = ({ type, label, icon: Icon, color }: { type: string, label: string, icon: any, color: string }) => {
  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="cursor-grab active:cursor-grabbing transform transition-all hover:scale-105"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className={`
        flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50
        shadow-sm hover:shadow-md transition-all group
      `}>
        <div className={`p-2 rounded-md ${color} text-white`}>
          <Icon size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[10px] text-muted-foreground">Drag to add</span>
        </div>
      </div>
    </div>
  );
};

export function FlowSidebar() {
  return (
    <aside className="w-64 border-r border-border bg-background/50 backdrop-blur-sm flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg tracking-tight">Tools</h2>
        <p className="text-xs text-muted-foreground">Drag nodes to the canvas</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Sources</h3>
          <DraggableNode type="inputNode" label="JSON Input" icon={FileJson} color="bg-blue-500" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Process</h3>
          <DraggableNode type="filterNode" label="Filter" icon={Filter} color="bg-purple-500" />
          <DraggableNode type="groupNode" label="Group By" icon={Layers} color="bg-orange-500" />
          <DraggableNode type="statsNode" label="Statistics" icon={Calculator} color="bg-green-500" />
          <DraggableNode type="sortNode" label="Sort" icon={ArrowUpDown} color="bg-cyan-600" />
          <DraggableNode type="limitNode" label="Limit" icon={Scissors} color="bg-slate-600" />
          <DraggableNode type="extremaNode" label="Min / Max" icon={TrendingUp} color="bg-rose-600" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Output</h3>
          <DraggableNode type="resultNode" label="Result Viewer" icon={ArrowRight} color="bg-zinc-500" />
        </div>

      </div>

      <div className="p-4 border-t border-border bg-secondary/20">
        <div className="text-[10px] text-muted-foreground text-center">
          Datablocks Clone v1.0
        </div>
      </div>
    </aside>
  );
}
