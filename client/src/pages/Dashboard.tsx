import { Link } from "wouter";
import { useFlows, useDeleteFlow } from "@/hooks/use-flows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Workflow, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { data: flows, isLoading } = useFlows();
  const deleteMutation = useDeleteFlow();

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              My Flows
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your data processing pipelines.
            </p>
          </div>
          <Link href="/editor/new">
            <Button size="lg" className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              <Plus className="w-5 h-5 mr-2" />
              New Flow
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading Skeletons
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-[200px] rounded-2xl bg-secondary/30 animate-pulse border border-border" />
            ))
          ) : flows?.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl bg-card/30">
              <div className="bg-secondary/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Workflow className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No flows created yet</h3>
              <p className="text-muted-foreground mb-6">Create your first data pipeline to get started.</p>
              <Link href="/editor/new">
                <Button variant="outline">Create Flow</Button>
              </Link>
            </div>
          ) : (
            flows?.map((flow) => (
              <Card 
                key={flow.id} 
                className="group hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/50 backdrop-blur-sm"
              >
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <span className="truncate pr-4" title={flow.name}>{flow.name}</span>
                    <Workflow className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-24 rounded-lg bg-secondary/20 border border-border/50 flex items-center justify-center overflow-hidden relative">
                    {/* Abstract Mini Visualization */}
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/50 via-transparent to-transparent" />
                    <div className="flex gap-2 items-center text-muted-foreground scale-75">
                      <div className="w-8 h-8 rounded border bg-card" />
                      <div className="w-4 h-0.5 bg-border" />
                      <div className="w-8 h-8 rounded border bg-card" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center text-sm text-muted-foreground pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {flow.createdAt ? formatDistanceToNow(new Date(flow.createdAt), { addSuffix: true }) : 'Just now'}
                  </div>
                  
                  <div className="flex gap-2">
                    <Link href={`/editor/${flow.id}`}>
                      <Button variant="ghost" size="sm" className="hover:text-primary">
                        Open
                      </Button>
                    </Link>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete flow?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the flow "{flow.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(flow.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
