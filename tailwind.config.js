/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs:  '390px',
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          50: '#fdf4ff',
          100: '#fae8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        }
      }
    },
  },
  plugins: [],
}

