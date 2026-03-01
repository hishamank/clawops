import { Card, CardContent } from "@/components/card";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-9 w-48 animate-pulse rounded bg-secondary" />
        <div className="mt-2 h-5 w-64 animate-pulse rounded bg-secondary" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-secondary" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
