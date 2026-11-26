/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        primaryDark: '#4338CA',
        ink: '#0F172A',
        muted: '#64748B',
        surface: '#FFFFFF',
        soft: '#F1F5F9',
        line: '#E2E8F0',
        success: '#16A34A',
        warn: '#D97706',
        danger: '#DC2626',
      },
      borderRadius: { 'card': '12px', 'card-lg': '16px', 'card-xl': '24px' },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(15,23,42,.08), 0 4px 16px rgba(15,23,42,.06)' },
    },
  },
  plugins: [],
};
