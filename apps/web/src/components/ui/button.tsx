import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white shadow-[0_0_24px_-4px_rgba(139,108,255,0.55)] hover:bg-brand/90 hover:shadow-[0_0_32px_-2px_rgba(139,108,255,0.75)]",
        glow:
          "bg-gradient-to-r from-[#8B6CFF] via-[#6D83FF] to-[#22D3EE] text-slate-950 font-semibold shadow-[0_0_28px_-4px_rgba(34,211,238,0.5)] hover:brightness-110",
        secondary:
          "bg-white/[0.07] text-foreground border border-white/10 hover:bg-white/[0.12] hover:border-white/20",
        outline:
          "border border-white/15 bg-white/[0.03] text-foreground hover:bg-white/[0.08] hover:border-brand/50",
        ghost:
          "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
