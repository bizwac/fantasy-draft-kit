import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-sunken": "var(--surface-sunken)",
        border: "var(--border)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-ink": "var(--accent-ink)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)"
      },
      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        body: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      fontVariantNumeric: {
        tabular: "tabular-nums"
      },
      spacing: {
        "4.5": "1.125rem"
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "22px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.04)",
        raised: "0 4px 16px rgba(0,0,0,0.12)"
      },
      transitionDuration: {
        DEFAULT: "180ms"
      },
      minHeight: {
        touch: "44px"
      },
      minWidth: {
        touch: "44px"
      }
    }
  },
  plugins: []
} satisfies Config;
