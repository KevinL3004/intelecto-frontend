/** Tokens de diseño SVI — ver sección 13 del documento. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Acento configurable (DP-16): cambiar aquí si Intelecto tiene color de marca
        accent: {
          50: '#eef2ff', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 950: '#1e1b4b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
