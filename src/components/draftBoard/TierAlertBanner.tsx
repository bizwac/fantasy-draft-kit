export default function TierAlertBanner({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="rounded-md bg-surface-sunken border border-accent px-4 py-2 flex flex-col gap-1" role="status">
      {alerts.map((alert, i) => (
        <p key={i} className="text-sm">
          <span className="font-semibold text-accent-strong">Tier break:</span> {alert}
        </p>
      ))}
    </div>
  );
}
