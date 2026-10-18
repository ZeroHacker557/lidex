// Mavzu tokenlari (index.css da CSS o'zgaruvchilar; Mini App'da Telegram ranglariga bog'langan).
// color-mix — `bg-brand/10` kabi shaffoflik modifikatorlari ishlashi uchun.
const token = (name) => `color-mix(in srgb, var(--c-${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app.html', './admin.html', './src/**/*.{ts,tsx}', '../shared/**/*.ts'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        fg: token('fg'),
        muted: token('muted'),
        line: token('line'),
        brand: token('brand'),
        'brand-fg': token('brand-fg'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 8px rgb(0 0 0 / 0.04)',
        pop: '0 10px 40px rgb(0 0 0 / 0.18)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.4' } },
      },
      animation: {
        'slide-up': 'slide-up .22s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .15s ease-out',
        'slide-in-right': 'slide-in-right .22s cubic-bezier(.2,.8,.2,1)',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
