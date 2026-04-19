import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f7f8f0',
          100: '#eef0e1',
          200: '#dce1c3',
          300: '#c4cc9a',
          400: '#a8b36e',
          500: '#8d9a4f',
          600: '#6e7b3b',
          700: '#4A5D23',
          800: '#3d4c1f',
          900: '#2e3a17',
        },
        terra: {
          50: '#fdf5f2',
          100: '#fbe8e0',
          200: '#f5cfc0',
          300: '#edae96',
          400: '#e28a6a',
          500: '#C75B39',
          600: '#b74a2c',
          700: '#993d25',
          800: '#7d3422',
          900: '#6a2e20',
        },
        cream: {
          50: '#FEFDFB',
          100: '#FAF7F2',
          200: '#F5EFE6',
          300: '#EDE4D4',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fadeIn: 'fadeIn 0.8s ease forwards',
      },
    },
  },
  plugins: [],
}

export default config
