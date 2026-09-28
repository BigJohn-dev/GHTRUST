import type { Config } from "tailwindcss";

/**
 * GH Trust design tokens.
 *
 * Brand: navy (#1B2F6B) for primary actions and headings, cyan as the accent.
 * Every colour used for text meets WCAG AA (4.5:1) on white and on the page
 * canvas; the original brand cyan (#2FA4D7) is kept as `cyan-bright` for fills
 * and dark backgrounds only, where it has the contrast.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1B2F6B", 600: "#22397F", 700: "#15255A", 900: "#0F1B3D" },
        cyan: { DEFAULT: "#0A74A6", bright: "#2FA4D7", soft: "#E6F4FA" },
        ink: { DEFAULT: "#0F1B3D", 2: "#475467", 3: "#667085" },
        line: { DEFAULT: "#E4E7EC", strong: "#D0D5DD" },
        canvas: "#F5F7FA",
        // Legacy names kept so older screens keep working, remapped to the new palette.
        "bg-light": "#F7F9FC",
        surface: "#F2F4F7",
        "surface-sidebar": "#0F1B3D",
        success: { DEFAULT: "#067647", soft: "#ECFDF3" },
        warning: { DEFAULT: "#B54708", soft: "#FFFAEB" },
        error: { DEFAULT: "#C4320A", soft: "#FEF3F2" },
        gold: "#B58838",
        // Neutral scale; 400 and up are dark enough for text.
        gray: {
          25: "#FCFCFD",
          50: "#F9FAFB",
          100: "#F2F4F7",
          200: "#E4E7EC",
          300: "#98A2B3",
          400: "#667085",
          500: "#475467",
          600: "#344054",
          700: "#1D2939",
          800: "#182230",
          900: "#101828",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(16, 24, 40, 0.05)",
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        "card-hover": "0 4px 8px -2px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.04)",
        pop: "0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)",
        ring: "0 0 0 4px rgba(10, 116, 166, 0.16)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "scale-out": { from: { opacity: "1", transform: "none" }, to: { opacity: "0", transform: "scale(0.97) translateY(2px)" } },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.985)", filter: "blur(3px)" },
          to: { opacity: "1", transform: "none", filter: "blur(0)" },
        },
        "grow-x": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "none" } },
        "slide-out-left": { from: { transform: "none" }, to: { transform: "translateX(-100%)" } },
        sheen: { from: { transform: "translateX(-120%) skewX(-18deg)" }, to: { transform: "translateX(220%) skewX(-18deg)" } },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%, -6%, 0) scale(1.08)" },
        },
      },
      animation: {
        "fade-up": "fade-up 200ms ease-out both",
        "fade-in": "fade-in 150ms ease-out both",
        "scale-in": "scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.4s infinite",
        "fade-out": "fade-out 140ms ease-in both",
        "scale-out": "scale-out 140ms ease-in both",
        "rise-in": "rise-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "grow-x": "grow-x 800ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-left": "slide-in-left 260ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-out-left": "slide-out-left 180ms ease-in both",
        sheen: "sheen 900ms ease-out",
        drift: "drift 18s ease-in-out infinite",
      },
      screens: {
        "3xl": "1920px",
      },
    },
  },
  plugins: [],
};
export default config;
