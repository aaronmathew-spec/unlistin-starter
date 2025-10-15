// components/ui/Card.tsx
import * as React from "react";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`card ${className}`} {...rest} />;
}
export function CardBody(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`p-5 ${className}`} {...rest} />;
}
export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{children}</h3>;
}
export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <p style={{ marginTop: 6, color: "var(--muted)" }}>{children}</p>;
}
