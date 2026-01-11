/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#1a1a2e',
        'game-card': '#16213e',
        'game-accent': '#0f3460',
        'game-highlight': '#e94560',
        'game-success': '#00d9ff',
        'game-warning': '#ffd93d',
      },
      fontFamily: {
        'game': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
