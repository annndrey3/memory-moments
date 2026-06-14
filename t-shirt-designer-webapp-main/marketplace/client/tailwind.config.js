/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
        brand: ["ArnoPro", "Georgia", "serif"],
        hero: ["MMHero", "Georgia", "serif"],
      },
      colors: {
        primary: {
          DEFAULT: "hsl(262 83% 58%)",
          foreground: "#fff",
        },
      },
      boxShadow: {
        soft: "0 2px 16px -2px rgb(0 0 0 / 0.06)",
        elevated: "0 8px 32px -4px rgb(0 0 0 / 0.1)",
        glow: "0 0 24px -4px hsl(262 83% 58% / 0.35)",
        pastel: "0 10px 40px -8px hsl(330 80% 70% / 0.25)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-slow": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(10px,-22px) scale(1.05)" },
        },
        blob: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(24px,-30px) scale(1.08)" },
          "66%": { transform: "translate(-18px,16px) scale(0.94)" },
        },
        "gradient-x": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 0 0 hsl(262 83% 60% / 0)" },
          "50%": { boxShadow: "0 0 20px 1px hsl(262 83% 65% / 0.45)" },
        },
        "badge-pop": {
          "0%": { transform: "scale(0)" },
          "60%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.7s ease-out both",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        blob: "blob 20s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "badge-pop": "badge-pop 0.45s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
