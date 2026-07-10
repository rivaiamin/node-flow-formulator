import { DragEvent } from 'react';
import {
  FileJson, FileSpreadsheet, Filter, ArrowUpDown, Scissors, Layers,
  Calculator, TrendingUp, GitMerge, Hash, ArrowRight,
} from "lucide-react";

const DraggableNode = ({ type, label, icon: Icon, color }: { type: string; label: string; icon: any; color: string }) => {
  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div className="cursor-grab active:cursor-grabbing transform transition-all hover:scale-105"
      onDragStart={(event) => onDragStart(event, type)} draggable>
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 shadow-sm hover:shadow-md transition-all group">
        <div className={`p-2 rounded-md ${color} text-white`}><Icon size={16} /></div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[10px] text-muted-foreground">Drag to add</span>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">{title}</h3>
    {children}
  </div>
);

export function FlowSidebar() {
  return (
    <aside className="w-64 border-r border-border bg-background/50 backdrop-blur-sm flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg tracking-tight">Tools</h2>
        <p className="text-xs text-muted-foreground">Drag nodes to the canvas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Section title="Sources">
          <DraggableNode type="source" label="Source" icon={FileJson} color="bg-blue-500" />
          <DraggableNode type="excel_input" label="Excel Input" icon={FileSpreadsheet} color="bg-emerald-600" />
        </Section>

        <Section title="Collection">
          <DraggableNode type="filter" label="Filter" icon={Filter} color="bg-purple-500" />
          <DraggableNode type="sort" label="Sort" icon={ArrowUpDown} color="bg-cyan-700" />
          <DraggableNode type="limit" label="Limit" icon={Scissors} color="bg-slate-600" />
          <DraggableNode type="group_by" label="Group By" icon={Layers} color="bg-orange-500" />
          <DraggableNode type="aggregate_groups" label="Aggregate Groups" icon={Calculator} color="bg-green-500" />
          <DraggableNode type="extrema" label="Min / Max" icon={TrendingUp} color="bg-rose-600" />
        </Section>

        <Section title="Combine / Scalar">
          <DraggableNode type="combine_by_key" label="Combine by Key" icon={GitMerge} color="bg-cyan-600" />
          <DraggableNode type="round" label="Round" icon={Hash} color="bg-indigo-500" />
        </Section>

        <Section title="Output">
          <DraggableNode type="output" label="Output" icon={ArrowRight} color="bg-zinc-600" />
        </Section>
      </div>

      <div className="p-4 border-t border-border bg-secondary/20">
        <div className="text-[10px] text-muted-foreground text-center">Report Card Formula Editor</div>
      </div>
    </aside>
  );
}
