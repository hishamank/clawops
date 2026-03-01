import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        online: "border-transparent bg-emerald-900 text-emerald-300",
        offline: "border-transparent bg-zinc-800 text-zinc-400",
        error: "border-transparent bg-red-900 text-red-300",
        running: "border-transparent bg-blue-900 text-blue-300",
        completed: "border-transparent bg-emerald-900 text-emerald-300",
        failed: "border-transparent bg-red-900 text-red-300",
        pending: "border-transparent bg-yellow-900 text-yellow-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
