import { Card, CardContent } from "@/components/card";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div>
          <div className="h-9 w-48 animate-pulse rounded bg-secondary" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-secondary" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
              <div className="mt-3 h-6 w-24 animate-pulse rounded bg-secondary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="h-6 w-32 animate-pulse rounded bg-secondary" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded bg-secondary"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
