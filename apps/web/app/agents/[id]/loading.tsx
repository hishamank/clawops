import { Skeleton } from "@/components/ui/skeleton";

export default function AgentLoading(): React.JSX.Element {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back link */}
      <Skeleton className="h-5 w-28" />

      {/* Identity strip */}
      <div className="flex items-start gap-6">
        <Skeleton className="h-20 w-20 rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content panels */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}

      {/* Performance */}
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}
