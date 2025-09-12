/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gb-navy': 'rgba(8,10,33,1)',
        'gb-gold': '#d4af37',
        'gb-gold-light': '#e6c55a',
        'gb-gold-dark': '#b8941f',
      },
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}