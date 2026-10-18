// Mavzu tokenlari index.css da CSS o'zgaruvchilar sifatida (yorug' / qorong'i).
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
        'surface-3': token('surface-3'),
        fg: token('fg'),
        muted: token('muted'),
        line: token('line'),
        brand: token('brand'),
        'brand-2': token('brand-2'),
        'brand-fg': token('brand-fg'),
        danger: token('danger'),
        warn: token('warn'),
        good: token('good'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Manrope Variable"', 'Manrope', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.04)',
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 4px 16px -4px rgb(16 24 40 / 0.08)',
        lift: '0 2px 4px rgb(16 24 40 / 0.04), 0 12px 32px -8px rgb(16 24 40 / 0.16)',
        pop: '0 24px 64px -12px rgb(16 24 40 / 0.35)',
        glow: '0 8px 24px -6px color-mix(in srgb, var(--c-brand) 55%, transparent)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, var(--c-brand) 0%, var(--c-brand-2) 100%)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { transform: 'scale(.8)', opacity: '.6' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(.2,.6,.4,1) infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
