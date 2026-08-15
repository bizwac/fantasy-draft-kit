import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/useTheme";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import logoLight from "@/assets/brand/lockup-light.png";
import logoDark from "@/assets/brand/lockup-dark.png";

const NAV_ITEMS = [
  { to: "/", label: "Drafts", end: true },
  { to: "/refresh", label: "Data Refresh" },
  { to: "/my-board", label: "My Board" }
];

function navLinkClass(isActive: boolean) {
  return [
    "flex items-center rounded-md px-3 min-h-touch font-medium transition-colors",
    isActive ? "bg-accent text-accent-ink" : "text-text-secondary hover:text-text-primary"
  ].join(" ");
}

export default function AppShell() {
  const { preference, setPreference } = useTheme();
  const online = useOnlineStatus();

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <header className="md:hidden flex items-center justify-between px-4 py-2 border-b border-border">
        <picture>
          <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
          <img src={logoLight} alt="Fade Signal" className="h-6" />
        </picture>
        <OnlineBadge online={online} />
      </header>

      <nav className="hidden md:flex md:flex-col md:w-56 shrink-0 border-r border-border p-4 gap-6">
        <img src={logoDark} alt="Fade Signal" className="h-7 hidden dark:block" />
        <img src={logoLight} alt="Fade Signal" className="h-7 dark:hidden" />
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => navLinkClass(isActive)}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-3">
          <OnlineBadge online={online} />
          <ThemeToggle preference={preference} onChange={setPreference} />
        </div>
      </nav>

      <main className="flex-1 min-w-0 p-4 md:p-8 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <Outlet />
      </main>
    </div>
  );
}

function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: online ? "var(--success)" : "var(--text-secondary)" }}
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function ThemeToggle({
  preference,
  onChange
}: {
  preference: "light" | "dark" | "system";
  onChange: (p: "light" | "dark" | "system") => void;
}) {
  const options: Array<{ value: "light" | "dark" | "system"; label: string }> = [
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
