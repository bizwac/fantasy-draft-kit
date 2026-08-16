import type { ThemePreference } from "@/lib/useTheme";

export default function ThemeToggle({
  preference,
  onChange
}: {
  preference: ThemePreference;
  onChange: (p: ThemePreference) => void;
}) {
  const options: Array<{ value: ThemePreference; label: string }> = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Auto" }
  ];
  return (
    <div className="flex rounded-md bg-surface-sunken p-0.5 text-xs" role="radiogroup" aria-label="Theme">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={preference === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "flex-1 rounded px-2 py-1.5 min-h-touch transition-colors",
            preference === opt.value ? "bg-accent text-accent-ink" : "text-text-secondary"
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
