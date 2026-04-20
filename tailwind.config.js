/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#f8f6f3',
        sand: '#e8e2d9',
        bark: '#3d3529',
        warm: '#8c7e6a',
        sage: '#5a6b52',
        sageLight: '#7a8d72',
        terracotta: '#c4553a',
        terracottaLight: '#d4714f',
      },
    },
  },
  plugins: [],
};