import { Card, CardContent } from "@/components/card";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-9 w-24 animate-pulse rounded bg-secondary" />
        <div className="mt-2 h-5 w-40 animate-pulse rounded bg-secondary" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-pulse rounded-md bg-secondary"
          />
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded bg-secondary"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
