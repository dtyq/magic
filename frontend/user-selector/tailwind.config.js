/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./demo/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
				},
			},
			zIndex: {
				popup: "var(--z-index-popup, 1001)",
				dialog: "var(--z-index-dialog, 1001)",
				dropdown: "var(--z-index-dropdown, 1001)",
				drawer: "var(--z-index-drawer, 1001)",
			},
			margin: {
				"safe-top": "var(--safe-area-inset-top, 0px)",
				"safe-bottom": "var(--safe-area-inset-bottom, 0px)",
				"safe-left": "var(--safe-area-inset-left, 0px)",
				"safe-right": "var(--safe-area-inset-right, 0px)",
			},
			padding: {
				"safe-top": "var(--safe-area-inset-top, 0px)",
				"safe-bottom": "var(--safe-area-inset-bottom, 0px)",
				"safe-left": "var(--safe-area-inset-left, 0px)",
				"safe-right": "var(--safe-area-inset-right, 0px)",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
}
