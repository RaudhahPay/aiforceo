import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      colors: {
        primary: "#1E2761",
        accent: "#F96167",
        gold: "#C5A572",
        ink: "#0F1729",
        muted: "#5A6478",
        line: "#E6E9F0",
        bg: "#FBFCFE",
        soft: "#F4F6FB",
        success: "#2A9D8F"
      }
    }
  },
  plugins: []
};
export default config;
