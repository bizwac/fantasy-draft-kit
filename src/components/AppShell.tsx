import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/useTheme";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import logoLight from "@/assets/brand/lockup-light.png";
import logoDark from "@/assets/brand/lockup-dark.png";

const NAV_ITEMS = [
  { to: "/", label: "Drafts", end: true },
  { to: "/refresh", label: "Data Refresh" },
  { to: "/my-board", label: "My Board" },
  { to: "/settings", label: "Settings" }
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
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <header className="md:hidden flex items-center justify-between px-4 py-2 border-b border-border print:hidden">
        <button
          type="button"
          className="shrink-0 min-h-touch min-w-touch flex items-center justify-center -ml-2 text-text-primary"
          aria-label="Open navigation menu"
          onClick={() => setNavOpen(true)}
        >
          <MenuIcon />
        </button>
        <picture>
          <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
          <img src={logoLight} alt="Fade Signal" className="h-8 w-auto" />
        </picture>
        <OnlineBadge online={online} />
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden bg-black/40" onClick={() => setNavOpen(false)} role="presentation">
          <div
            className="card h-full w-[280px] max-w-[80vw] rounded-none rounded-r-lg p-4 flex flex-col gap-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between">
              <picture>
                <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
                <img src={logoLight} alt="Fade Signal" className="h-8 w-auto" />
              </picture>
              <button
                type="button"
                className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-text-secondary"
                aria-label="Close navigation menu"
                onClick={() => setNavOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => navLinkClass(isActive)}
                    onClick={() => setNavOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-3">
              <OnlineBadge online={online} />
              <ThemeToggle preference={preference} onChange={setPreference} />
            </div>
          </div>
        </div>
      )}

      <nav className="hidden md:flex md:flex-col md:w-56 shrink-0 border-r border-border p-4 gap-6 print:hidden">
        <img src={logoDark} alt="Fade Signal" className="h-10 w-auto self-start hidden dark:block" />
        <img src={logoLight} alt="Fade Signal" className="h-10 w-auto self-start dark:hidden" />
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

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
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
