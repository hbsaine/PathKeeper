/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08070d',
        surface: '#0f0e18',
        elevated: '#16142a',
        accent: '#9333ea',
        'accent-light': '#c084fc',
        gold: '#d4a017',
        danger: '#dc2626',
        success: '#16a34a',
        'text-primary': '#e8e4f0',
        'text-secondary': '#6b6580',
        'text-muted': '#3d3650',
        border: 'rgba(147, 51, 234, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
