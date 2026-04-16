import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#b8d9ff",
          300: "#8ec2ff",
          400: "#5da2ff",
          500: "#347fff",
          600: "#1f61e9",
          700: "#194dba",
          800: "#1a4298",
          900: "#1c397b"
        },
        ink: "#10234b",
        mist: "#f5f9ff"
      },
      boxShadow: {
        soft: "0 20px 60px -28px rgba(15, 48, 120, 0.28)",
        float: "0 10px 30px -18px rgba(29, 78, 216, 0.34)"
      },
      backgroundImage: {
        aurora:
          "radial-gradient(circle at top left, rgba(120, 182, 255, 0.34), transparent 32%), radial-gradient(circle at top right, rgba(255, 255, 255, 0.95), transparent 28%), linear-gradient(180deg, rgba(243, 249, 255, 0.95), rgba(226, 238, 255, 0.92))"
      }
    }
  },
  plugins: []
};

export default config;
