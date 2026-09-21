import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1B2F6B",
        cyan: "#2FA4D7",
        "bg-light": "#E9F8F9",
        surface: "#F4F7FB",
        "surface-sidebar": "#EEF2F9",
        success: "#00A86B",
        warning: "#E5AF59",
        error: "#CF2E2E",
        gold: "#B58838",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["Montserrat", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(27, 47, 107, 0.06), 0 8px 24px rgba(27, 47, 107, 0.06)",
        "card-hover": "0 4px 12px rgba(27, 47, 107, 0.1), 0 12px 32px rgba(27, 47, 107, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
