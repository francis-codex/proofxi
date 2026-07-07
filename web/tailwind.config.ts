import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        panel: "var(--panel)",
        panel2: "var(--panel-2)",
        line: "var(--line)",
        bone: "var(--bone)",
        "bone-dim": "var(--bone-dim)",
        "bone-mute": "var(--bone-mute)",
        confirm: "var(--confirm)",
        overturn: "var(--overturn)",
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      letterSpacing: {
        display: "-0.01em",
        micro: "0.18em",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(236,231,218,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.9)",
      },
    },
  },
  plugins: [],
};

export default config;
