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
        primary: "#F59E0B",
        "primary-dark": "#D97706",
        sidebar: "#1c1006",
        "text-heading": "#1c1006",
        "text-body": "#44403c",
        "text-sub": "#6B778C",
        border: "#fde68a",
        "bg-page": "#fef3d0",
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
