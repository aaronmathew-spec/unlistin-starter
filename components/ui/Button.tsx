// components/ui/Button.tsx
"use client";
import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
};
export function Button({ variant = "solid", className = "", ...rest }: Props) {
  const base = "btn";
  const v = variant === "outline" ? "btn-outline" : variant === "ghost" ? "btn-ghost" : "";
  return <button className={`${base} ${v} ${className}`} {...rest} />;
}
