/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Exact row separator from design (#f4f4f6 — between zinc-50 and zinc-100)
        row: '#f4f4f6',
        // Status semantic colors
        'success-bg':  '#dcfce7',
        'success-fg':  '#15803d',
        'success-dot': '#16a34a',
        'warning-bg':  '#fef9c3',
        'warning-fg':  '#a16207',
        'warning-dot': '#ca8a04',
        'error-bg':    '#fee2e2',
        'error-fg':    '#b91c1c',
        'error-dot':   '#dc2626',
        'orange-dot':  '#ea580c',
      },
    },
  },
  plugins: [],
}
