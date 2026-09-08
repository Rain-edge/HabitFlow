/** @type {import('tailwindcss').Config}
 *
 * HabitFlow Design System — "quiet, fresh, gently positive"
 * Semantic surface/ink/line tokens are CSS variables (auto dark mode).
 * Brand / state colors are fixed scales (support opacity modifiers).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- semantic surfaces / text / borders (flip in dark mode) ---
        surface: "rgb(var(--surface) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-2": "rgb(var(--card-2) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--line) / <alpha-value>)",
          2: "rgb(var(--line-2) / <alpha-value>)",
        },

        // --- brand: calm teal-green (life / flow / growth) ---
        brand: {
          50: "#EFFAF7",
          100: "#D7F2EC",
          200: "#B0E4DB",
          300: "#7ED0C3",
          400: "#48B7A7",
          500: "#18A396",
          600: "#12877C",
          700: "#116B62",
          800: "#11554E",
          900: "#0F4640",
        },

        // --- warm accent: streak / achievement (a little positivity) ---
        flame: {
          100: "#FDE8D9",
          500: "#F5822B",
          600: "#E06F1B",
        },

        // --- state colors ---
        success: { 100: "#DFF3E8", 500: "#2FA36B", 600: "#278A5A" },
        warning: { 100: "#FBF0D2", 500: "#E8A400", 600: "#C08A00" },
        danger: { 100: "#FBE3E4", 500: "#E5484D", 600: "#C93A3F", 700: "#AC2B30" },
      },

      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI", "PingFang SC",
          "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "sans-serif",
        ],
        // distinctive, tabular-friendly numerals for streaks / percentages
        display: ["Manrope", "-apple-system", "Segoe UI", "PingFang SC", "sans-serif"],
      },

      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        card: "20px",
        modal: "24px",
      },

      boxShadow: {
        xs: "0 1px 2px 0 rgb(16 44 38 / 0.04)",
        sm: "0 1px 3px 0 rgb(16 44 38 / 0.06), 0 1px 2px -1px rgb(16 44 38 / 0.04)",
        md: "0 4px 14px -2px rgb(16 44 38 / 0.07)",
        lg: "0 12px 32px -8px rgb(16 44 38 / 0.10)",
        ring: "0 0 0 3px rgb(24 163 150 / 0.18)",
      },

      // gentle, non-distracting motion
      transitionTimingFunction: {
        soft: "cubic-bezier(0.25, 0.6, 0.35, 1)",
      },
      animation: {
        "pop": "hf-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-up": "hf-fade-up 0.3s ease both",
        "shimmer": "hf-shimmer 1.4s linear infinite",
        "zoom-in": "hf-zoom-in 0.18s ease both",
        "toast-in": "hf-toast-in 0.25s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        "check-pop": "hf-check-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "hf-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "hf-fade-up": {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "hf-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "hf-zoom-in": {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "hf-toast-in": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "hf-check-pop": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
