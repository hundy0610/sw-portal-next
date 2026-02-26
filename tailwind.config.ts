import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0052CC",
        "primary-dark": "#0747A6",
        sidebar: "#1C2B4A",
        "text-heading": "#172B4D",
        "text-body": "#344563",
        "text-sub": "#6B778C",
        border: "#DFE1E6",
        "bg-page": "#F4F5F7",
        success: "#006644",
        "success-bg": "#E3FCEF",
        warning: "#974F0C",
        "warning-bg": "#FFFAE6",
        danger: "#BF2600",
        "danger-bg": "#FFEBE6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
