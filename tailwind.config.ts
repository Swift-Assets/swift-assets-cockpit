import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // shadcn semantic tokens — HSL triplets with alpha support so opacity
        // modifiers (e.g. bg-muted/50, border-border/70) work correctly.
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        // Traffic-light + accent statuses (tied to brand tokens).
        status: {
          green: "hsl(var(--status-green) / <alpha-value>)",
          yellow: "hsl(var(--status-yellow) / <alpha-value>)",
          red: "hsl(var(--status-red) / <alpha-value>)",
          blue: "hsl(var(--status-blue) / <alpha-value>)",
          gray: "hsl(var(--status-gray) / <alpha-value>)",
        },
        // Brand chrome neutrals (HSL triplets), repointed to dark glass.
        ink: "hsl(var(--ink) / <alpha-value>)",
        "ink-soft": "hsl(var(--ink-soft) / <alpha-value>)",
        "ink-mid": "hsl(var(--ink-mid) / <alpha-value>)",
        mute: "hsl(var(--mute) / <alpha-value>)",
        "mute-2": "hsl(var(--mute-2) / <alpha-value>)",
        nav: "hsl(var(--nav) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        paper: "hsl(var(--paper) / <alpha-value>)",
        // Glass surfaces & accents (full values with baked-in alpha) — used
        // directly; not intended for Tailwind opacity modifiers.
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "accent-3": "var(--accent-3)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        low: "var(--low)",
        panel: "var(--panel)",
        "panel-strong": "var(--panel-strong)",
        "panel-solid": "var(--panel-solid)",
      },
      borderRadius: {
        lg: "var(--radius)", // 22px — cards, panels
        md: "calc(var(--radius) - 8px)", // 14px — buttons, inputs
        sm: "calc(var(--radius) - 14px)", // 8px — small chips
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
        glow: "var(--glow)",
      },
      backdropBlur: {
        glass: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
