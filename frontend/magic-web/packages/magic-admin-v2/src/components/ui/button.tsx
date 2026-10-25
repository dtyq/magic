import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import type { ButtonHTMLAttributes } from "react";
import { buttonVariants } from "@magic-admin-v2/components/ui/button-variants";
import { cn } from "@magic-admin-v2/utils/cn";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      type={type}
      {...props}
    />
  ),
);

Button.displayName = "Button";
