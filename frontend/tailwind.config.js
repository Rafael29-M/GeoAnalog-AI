/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: { 50:'#f4f5f4',100:'#e9eceb',200:'#d4dadd',300:'#bec8cc',400:'#a5b1b8',500:'#8b989f',600:'#65727b',700:'#47535c',800:'#303a42',900:'#21292f',950:'#15191d' },
        emerald: { 200:'#d7e1d6',300:'#b9cbb7',400:'#a6bca5',500:'#849e87',600:'#697e6b',700:'#516553',800:'#394b3e',900:'#29392e',950:'#202c24' },
        orange: { 200:'#e1cbbb',300:'#d5b9a3',400:'#c6a68b',500:'#af8b6d',600:'#806047',700:'#72543f',800:'#604736',900:'#42332a',950:'#302720' },
        amber: { 200:'#e2d5b7',300:'#d4c49f',400:'#c2b38d',500:'#b1a078',800:'#665b41',950:'#332e23' },
        blue: { 200:'#ccd8df',300:'#b9cbd5',400:'#9eb7c5',500:'#7f9bab',600:'#607f91',900:'#2a3d48',950:'#202e37' },
        space: {
          950: '#15191d',
          900: '#1d2328',
          850: '#252c32',
          800: '#303a41',
          750: '#39464f',
          700: '#47565f',
          600: '#60717b',
        },
        mars: {
          primary: '#c1440e',
          accent: '#e05a2b',
          surface: '#8f3008',
          card: '#221511',
          border: '#4d2316',
        },
        luna: {
          primary: '#94a3b8',
          accent: '#cbd5e1',
          surface: '#475569',
          card: '#151e2e',
          border: '#2a3952',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
