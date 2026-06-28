import type { Config } from "tailwindcss";

// Design tokens mirror prototype/assets/theme.css (Design Strategy §2).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#1a1714",
        surface: "#252019",
        "surface-2": "#2f2820",
        board: "#d9a86c",
        "board-line": "#6b4f30",
        "stone-black": "#1b1b1f",
        "stone-white": "#f4f1ea",
        primary: "#e0a458",
        accent: "#4ea1d3",
        success: "#5cb85c",
        danger: "#e0573e",
        win: "#ffd34d",
        text: "#f2ece2",
        "text-dim": "#a99e8d",
        border: "#3a322a",
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "22px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 6px 24px rgba(0,0,0,.35)",
        stone: "0 2px 4px rgba(0,0,0,.5)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "PingFang TC",
          "Noto Sans TC",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      keyframes: {
        pulse: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
        toastIn: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "none" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "none" },
        },
        coinflip: { to: { transform: "rotateX(1980deg)" } },
      },
      animation: {
        pulseSoft: "pulse 1s infinite",
        toastIn: "toastIn .25s ease",
        slideUp: "slideUp .3s ease",
        coinflip: "coinflip 1.6s cubic-bezier(.3,.1,.2,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
