/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4a853',
          light: '#e8c97a',
          dark: '#b8922f',
        },
        emerald: {
          DEFAULT: '#2dd4a8',
          dark: '#1a9a7a',
        },
        navy: {
          DEFAULT: '#0a0e1a',
          light: '#131828',
          mid: '#1c2236',
        },
        surface: {
          DEFAULT: '#1a1f35',
          light: '#242a44',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};