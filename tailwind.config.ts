import type { Config } from "tailwindcss";

// Colours come from CSS variables in src/styles/index.css (see docs/DESIGN.md).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        panel: token("panel"),
        raised: token("raised"),
        overlay: token("overlay"),
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        ink: { DEFAULT: token("ink"), 2: token("ink-2") },
        muted: token("muted"),
        primary: { DEFAULT: token("primary"), hover: token("primary-hover"), fg: token("primary-fg"), ink: token("primary-ink") },
        accent: token("accent"),
        good: token("good"),
        watch: token("watch"),
        risk: token("risk"),
        late: token("late"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        page: "1200px",
        prose: "65ch",
      },
      boxShadow: {
        pop: "0 16px 48px -12px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(var(--line))",
      },
    },
  },
  plugins: [],
} satisfies Config;
