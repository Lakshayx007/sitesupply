import type { Config } from "tailwindcss";

// Colours come from CSS variables (src/styles/index.css) so light and dark mode share one set of names.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: token("ink"),
        muted: token("muted"),
        surface: token("surface"),
        subtle: token("subtle"),
        border: token("border"),
        primary: { DEFAULT: token("primary"), fg: token("primary-fg"), ink: token("primary-ink") },
        accent: { DEFAULT: token("accent"), ink: token("accent-ink") },
        status: {
          good: token("status-good"),
          watch: token("status-watch"),
          risk: token("status-risk"),
          late: token("status-late"),
          "good-ink": token("status-good-ink"),
          "watch-ink": token("status-watch-ink"),
          "risk-ink": token("status-risk-ink"),
          "late-ink": token("status-late-ink"),
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.04)",
      },
      maxWidth: {
        page: "1200px",
      },
    },
  },
  plugins: [],
} satisfies Config;
