/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Kept in sync by hand with src/theme/colors.ts — Tailwind config can't import
      // TS at build time in the RN toolchain, so the palette is intentionally
      // duplicated in both places. Update both together.
      colors: {
        cream: "#FFF8F1",
        charcoal: "#2B2320",
        clay: "#C1622A",
        clayDark: "#9C4C1F",
        sage: "#5C7A5E",
        gold: "#E0A93B",
        stone: "#8A7F76",
        mist: "#F1EAE2",
      },
      fontFamily: {
        display: ["System"],
        body: ["System"],
      },
    },
  },
  plugins: [],
};
