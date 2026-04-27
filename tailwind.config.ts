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
        /* 브랜드 오렌지 — idsTrust / 대웅 그룹웨어 통일 */
        orange: {
          DEFAULT: "#F47C20",
          dark:    "#D9690F",
          deep:    "#B85510",
          light:   "#FEF4EC",
          mid:     "#FBEEE3",
          soft:    "#FFF9F5",
        },
        /* 서피스 */
        "page-bg":  "#F5F6F8",
        "card-bg":  "#FFFFFF",
        "section-bg":"#F9FAFB",
        /* 텍스트 */
        "text-1": "#1A1A1A",
        "text-2": "#3D3D3D",
        "text-3": "#767676",
        "text-4": "#AAAAAA",
        /* 경계 */
        "border-c":      "#E5E5E5",
        "border-light-c":"#EFEFEF",
        /* 어드민 */
        sidebar: "#1B2333",
        /* 상태 */
        success:      "#0D9488",
        "success-bg": "#F0FDFA",
        warning:      "#D97706",
        "warning-bg": "#FFFBEB",
        danger:       "#DC2626",
        "danger-bg":  "#FEF2F2",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable", "Pretendard",
          "-apple-system", "BlinkMacSystemFont",
          "Apple SD Gothic Neo", "Noto Sans KR", "sans-serif",
        ],
      },
      borderRadius: {
        sm:  "4px",
        DEFAULT: "6px",
        md:  "8px",
        lg:  "10px",
        xl:  "12px",
      },
      boxShadow: {
        card:       "0 1px 3px rgba(0,0,0,0.06)",
        "card-hover":"0 3px 12px rgba(0,0,0,0.09)",
        panel:      "0 2px 8px rgba(0,0,0,0.07)",
        orange:     "0 3px 10px rgba(244,124,32,0.28)",
      },
    },
  },
  plugins: [],
};
export default config;
