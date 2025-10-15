// components/ui/EmptyState.tsx
export default function EmptyState({
  title,
  subtitle,
  cta,
}: { title: string; subtitle?: string; cta?: React.ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      {subtitle && <div style={{ marginTop: 6 }}>{subtitle}</div>}
      {cta && <div style={{ marginTop: 12 }}>{cta}</div>}
    </div>
  );
}
