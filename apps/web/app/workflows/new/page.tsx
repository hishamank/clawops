import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewWorkflowForm } from "./workflow-form";

export default function NewWorkflowPage(): React.JSX.Element {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workflows">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Create Workflow</h1>
          <p className="mt-1 text-muted-foreground">Define a new automated workflow</p>
        </div>
      </div>

      <NewWorkflowForm />
    </div>
  );
}
