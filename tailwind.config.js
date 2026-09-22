/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Chess board colors matching inspiration screenshots
        'board-light': '#f3f3eb',
        'board-dark': '#7ea4f6',
        'board-highlight': 'rgba(255, 240, 216, 0.7)',
        'board-selected': 'rgba(160, 208, 224, 0.4)',
        // UI colors matching inspiration screenshots (light theme)
        'bg-dark': '#faf9f6',
        'bg-darker': '#f3f2ee',
        'bg-card': '#ffffff',
        'text-primary': '#202020',
        'text-secondary': '#6b7280',
        'accent': '#3273f5',
        'accent-hover': '#4c85f7',
        'danger': '#e83808',
      },
      animation: {
        'piece-move': 'piece-move 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'piece-move': {
          '0%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
