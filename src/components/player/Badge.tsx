import type { ReactNode } from "react";

const TONE_COLOR: Record<string, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
  info: "var(--info)",
  neutral: "var(--text-secondary)"
};

export default function Badge({
  tone,
  children
}: {
  tone: "danger" | "warning" | "success" | "info" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `color-mix(in srgb, ${TONE_COLOR[tone]} 18%, transparent)`, color: TONE_COLOR[tone] }}
    >
      {children}
    </span>
  );
}
