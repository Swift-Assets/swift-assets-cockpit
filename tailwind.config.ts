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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Traffic-light statuses (restrained; tied to brand tokens).
        status: {
          green: "hsl(var(--status-green))",
          yellow: "hsl(var(--status-yellow))",
          red: "hsl(var(--status-red))",
          blue: "hsl(var(--status-blue))",
          gray: "hsl(var(--status-gray))",
        },
        // Exact Swift Assets brand neutrals (from website source).
        ink: "hsl(var(--ink))",
        "ink-soft": "hsl(var(--ink-soft))",
        "ink-mid": "hsl(var(--ink-mid))",
        mute: "hsl(var(--mute))",
        "mute-2": "hsl(var(--mute-2))",
        nav: "hsl(var(--nav))",
        line: "hsl(var(--line))",
        paper: "hsl(var(--paper))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};

export default config;
