import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/useTheme";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import logoLight from "@/assets/brand/lockup-light.png";
import logoDark from "@/assets/brand/lockup-dark.png";
import ThemeToggle from "@/components/shared/ThemeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Drafts", end: true },
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
        <Link to="/" aria-label="Fade Signal home">
          <picture>
            <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
            <img src={logoLight} alt="Fade Signal" className="h-8 w-auto" />
          </picture>
        </Link>
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
              <Link to="/" aria-label="Fade Signal home" onClick={() => setNavOpen(false)}>
                <picture>
                  <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
                  <img src={logoLight} alt="Fade Signal" className="h-8 w-auto" />
                </picture>
              </Link>
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

      <nav
        className="hidden md:flex md:flex-col md:w-56 shrink-0 border-r border-border px-4 gap-6 overflow-y-auto print:hidden"
        style={{
          // max(), not +, as a floor: iPadOS has a known quirk where
          // safe-area-inset-top under-reports (sometimes 0) for a
          // standalone PWA in landscape, which previously left the logo
          // sitting right under the status bar with no real clearance.
          paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 0.5rem))",
          paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 0.5rem))"
        }}
      >
        <Link to="/" aria-label="Fade Signal home" className="self-start">
          <img src={logoDark} alt="Fade Signal" className="h-10 w-auto hidden dark:block" />
          <img src={logoLight} alt="Fade Signal" className="h-10 w-auto dark:hidden" />
        </Link>
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

