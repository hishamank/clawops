import { Card, CardContent } from "@/components/card";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-9 w-32 animate-pulse rounded bg-secondary" />
        <div className="mt-2 h-5 w-48 animate-pulse rounded bg-secondary" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
              <div className="mt-4 h-4 w-48 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-4 w-40 animate-pulse rounded bg-secondary" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
