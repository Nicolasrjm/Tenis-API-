/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tennis: {
          bg: '#07110B',
          panel: '#0C1A11',
          card: '#102216',
          cardHover: '#152C1D',
          border: '#1B3624',
          borderBright: '#295437',
          neon: '#39FF88',
          secondary: '#16C96B',
          white: '#F5F7F5',
          gray: '#8C9891',
          darkGray: '#47544C',
          accentRed: '#FF4D6D',
          accentGold: '#FFD166',
          accentBlue: '#00F0FF'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Rajdhani', 'Impact', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace']
      },
      boxShadow: {
        'neon': '0 0 15px rgba(57, 255, 136, 0.25)',
        'neon-strong': '0 0 25px rgba(57, 255, 136, 0.45)',
        'neon-sm': '0 0 8px rgba(57, 255, 136, 0.2)',
        'target': '0 0 30px rgba(57, 255, 136, 0.3), inset 0 0 30px rgba(57, 255, 136, 0.15)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'scan': 'scan 3s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(57, 255, 136, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(57, 255, 136, 0.6)' }
        }
      }
    },
  },
  plugins: [],
}
