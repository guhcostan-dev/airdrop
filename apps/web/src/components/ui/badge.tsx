import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand/20 text-[#C4B5FD]",
        brand: "border-brand/40 bg-brand/15 text-[#C4B5FD] shadow-[0_0_16px_-4px_rgba(139,108,255,0.4)]",
        cyan: "border-cyan-400/35 bg-cyan-400/10 text-cyan-300",
        emerald: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
        amber: "border-amber-400/35 bg-amber-400/10 text-amber-300",
        rose: "border-rose-400/35 bg-rose-400/10 text-rose-300",
        secondary: "border-white/10 bg-white/[0.05] text-muted-foreground",
        outline: "border-white/15 bg-transparent text-foreground",
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

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
