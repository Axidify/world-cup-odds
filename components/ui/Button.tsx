import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-[oklch(0.16_0.02_250)] border-transparent hover:bg-brand-strong",
  secondary:
    "bg-surface-2 text-text border-border hover:border-brand",
  ghost: "bg-transparent text-text-muted border-transparent hover:text-text hover:bg-surface-2",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "secondary", children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
