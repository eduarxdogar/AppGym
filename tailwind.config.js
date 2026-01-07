/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,ts,scss}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#09090b", // Zinc-950
        foreground: "#fafafa", // Zinc-50
        primary: {
          DEFAULT: "#e11d48", // Rose-600
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#27272a", // Zinc-800
          foreground: "#fafafa",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "#27272a", // Zinc-800
          foreground: "#a1a1aa", // Zinc-400
        },
        accent: {
          DEFAULT: "#27272a", // Zinc-800
          foreground: "#fafafa",
        },
        popover: {
          DEFAULT: "#09090b",
          foreground: "#fafafa",
        },
        card: {
          DEFAULT: "#09090b",
          foreground: "#fafafa",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-in-out',
        slideUp: 'slideUp 0.5s ease-out',
        bounceIn: 'bounceIn 0.6s ease-in-out',
        slideDown: 'slideDown 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideDown: {
          '0%': { maxHeight: '0', opacity: '0' },
          '100%': { maxHeight: '500px', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
