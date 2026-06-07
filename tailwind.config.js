/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './main.jsx', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ton: '#0098ea',
        poly: '#8247e5',
        gain: '#00d4aa',
      },
    },
  },
  plugins: [],
}
