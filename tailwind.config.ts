import type { Config } from "tailwindcss";

/**
 * justcoffee brand system (from the campaign reference):
 *   palette — paper / ink / teal / terracotta / tan / espresso
 *   type    — Helvetica Neue (sans) + Georgia italic (serif accent)
 *   device  — two overlapping rings (you + a stranger) with rising steam
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F0E7D5",
        "paper-dim": "#E7DCC6",
        ink: "#281A12",
        teal: {
          DEFAULT: "#15625C",
          deep: "#0F4A45",
          soft: "#2C7C75",
        },
        terracotta: "#C2613B",
        tan: "#C2A883",
        espresso: "#2E1F15",
        "espresso-2": "#241710",
      },
      fontFamily: {
        sans: [
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
        serif: ['Georgia', '"Times New Roman"', "serif"],
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        card: "0 18px 50px -24px rgba(40,26,18,0.45)",
        lift: "0 10px 30px -14px rgba(40,26,18,0.35)",
      },
      keyframes: {
        steam: {
          "0%": { transform: "translateY(2px) scaleX(1)", opacity: "0" },
          "30%": { opacity: "0.7" },
          "100%": { transform: "translateY(-10px) scaleX(0.85)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.6" },
          "70%": { transform: "scale(1.25)", opacity: "0" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        steam: "steam 2.6s ease-in-out infinite",
        "fade-up": "fade-up 0.45s ease-out both",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
