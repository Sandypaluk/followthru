/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3F4F1',
        ink: '#1C1E1B',
        graphite: '#565A53',
        rule: '#D9DAD3',
        accent: '#2F5D62',      // primary action color — deep teal, not the AI-cliche terracotta
        overdue: '#B2412F',
        today: '#B5791E',
        waiting: '#2E5C8A',
        response: '#3D6B66',
        info: '#7A7E74',
      },
      fontFamily: {
        display: ['Newsreader', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
