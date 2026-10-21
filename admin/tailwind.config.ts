import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			blue: { '50': '#EBF3FF', '100': '#CFE3FF', '200': '#A9CBFF', '300': '#7DB2FF', '400': '#4C94FF', '500': '#1F7BFF', '600': '#0A6CFF', '700': '#0A5CE0', '800': '#0A4FD6', '900': '#0840AD' },
  			indigo: { '50': '#EBF3FF', '100': '#CFE3FF', '200': '#A9CBFF', '300': '#7DB2FF', '400': '#4C94FF', '500': '#1F7BFF', '600': '#0A6CFF', '700': '#0A5CE0', '800': '#0A4FD6', '900': '#0840AD' },
  			green: { '50': '#E6FAEC', '100': '#C8F2D4', '200': '#9BE8B5', '300': '#5FD58A', '400': '#2EC26A', '500': '#12B24A', '600': '#0E9A3F', '700': '#0A7A32', '800': '#086A2B', '900': '#065522' },
  			red: { '50': '#FFEEEC', '100': '#FFD3CF', '200': '#FFB0A9', '300': '#FF7A70', '400': '#FF5A4E', '500': '#FF3B30', '600': '#E02D22', '700': '#C0221A', '800': '#A3150C', '900': '#86110A' },
  			amber: { '50': '#FFF8D6', '100': '#FFEFA8', '200': '#FFE27A', '300': '#FFD84D', '400': '#FFC926', '500': '#FFB800', '600': '#E09F00', '700': '#B88000', '800': '#8F5A00', '900': '#6E4500' },
  			orange: { '50': '#FFF1E0', '100': '#FFE0BD', '200': '#FFC78F', '300': '#FFA95C', '400': '#FF8E33', '500': '#FF7A00', '600': '#E06800', '700': '#B85400', '800': '#8F4100', '900': '#6E3300' },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
