/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Protokol Brand Colors
        bg: {
          base: '#0E0F11',
          card: '#16181C',
          elevated: '#1E2026',
          border: '#2A2D35',
        },
        gold: {
          DEFAULT: '#E6C475',
          light: '#F0D490',
          dark: '#C9A84C',
          muted: 'rgba(230, 196, 117, 0.15)',
        },
        brand: {
          red: '#E8432A',      // Protokol logo icon color
          'red-dark': '#C03520',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9E9E9E',
          muted: '#5A5F6E',
        },
        status: {
          success: '#4CAF72',
          warning: '#E6C475',
          error: '#E84343',
          info: '#4A90D9',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(230, 196, 117, 0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'glow-red': '0 0 20px rgba(232, 67, 42, 0.3)',
      },
    },
  },
  plugins: [],
}
