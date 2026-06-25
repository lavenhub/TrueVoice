/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        secondary: "#64748b",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        purple: "#8b5cf6",
        orange: "#f97316",
      },
      borderRadius: {
        'lg': '24px',
        'md': '16px',
        'sm': '8px',
      },
    },
  },
  plugins: [],
}
