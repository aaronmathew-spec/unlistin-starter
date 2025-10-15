// components/ui/FormField.tsx
import * as React from "react";
export function FormField({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
