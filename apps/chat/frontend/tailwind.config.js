/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Norwegian Design System colors (can be customized)
        primary: {
          DEFAULT: '#002C54',
          light: '#0051A3',
          dark: '#001733',
        },
      },
    },
  },
  plugins: [],
}
