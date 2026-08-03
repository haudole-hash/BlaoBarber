/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Tan #D2B48C — nền / viền / nút; chữ luôn đen */
        tan: "#D2B48C",

        primary: "#D2B48C",
        "on-primary": "#000000",
        "primary-container": "#F5EDE3",
        "on-primary-container": "#000000",
        "primary-fixed": "#E8D9C8",
        "primary-fixed-dim": "#000000",

        secondary: "#8B5E3C",
        "on-secondary": "#000000",
        "secondary-container": "#F0DDD0",
        "secondary-fixed": "#F8EAE2",

        tertiary: "#A0826D",
        "on-tertiary": "#000000",
        "tertiary-fixed": "#F0E8DE",
        "on-tertiary-container": "#000000",
        "on-tertiary-fixed": "#000000",
        "tertiary-container": "#E8D5C4",

        background: "#FFFBF7",
        "on-background": "#000000",
        surface: "#FFFFFF",
        "on-surface": "#000000",
        "on-surface-variant": "#000000",

        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#FAF6F1",
        "surface-container": "#F5EDE3",
        "surface-container-high": "#EDE4D8",
        "surface-container-highest": "#E8D9C8",

        outline: "#000000",
        "outline-variant": "#DDD0C0",

        error: "#B3261E",
        "on-error": "#FFFFFF",
        "error-container": "#F9DEDC",
        "on-error-container": "#000000",
      },
      spacing: {
        "margin-desktop": "40px",
        gutter: "24px",
        "margin-mobile": "16px",
      },
      fontFamily: {
        "headline-lg": ["EB Garamond", "serif"],
        "headline-md": ["EB Garamond", "serif"],
        "headline-xl": ["EB Garamond", "serif"],
        "label-md": ["Hanken Grotesk", "sans-serif"],
        "label-sm": ["Hanken Grotesk", "sans-serif"],
        "body-md": ["Hanken Grotesk", "sans-serif"],
        "body-lg": ["Hanken Grotesk", "sans-serif"],
      },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "500" }],
        "headline-xl": ["48px", { lineHeight: "56px", fontWeight: "600" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.03em", fontWeight: "700" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
