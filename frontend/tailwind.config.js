/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07070A',
          900: '#0B0C11',
          850: '#101117',
          800: '#15171E',
          700: '#1D2028',
          600: '#282C36',
          500: '#3A3F4C',
        },
        chalk: {
          DEFAULT: '#F2F4F7',
          muted: '#9BA1AE',
          dim: '#6B7280',
        },
        // Light-theme equivalents (used when .light is on <html>).
        paper: {
          50: '#FFFFFF',
          100: '#F8FAFC',
          200: '#F1F5F9',
          300: '#E2E8F0',
          400: '#CBD5E1',
          500: '#94A3B8',
          600: '#64748B',
        },
        acid: '#CDFF4B',
        grape: '#A98BFF',
        tangerine: '#FF8A3D',
        sky: '#49CFF0',
        rose: '#FF6B8B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
};
