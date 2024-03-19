import animate from "tailwindcss-animate"
import colors from "tailwindcss/colors"

function oklchColor(colorVar, alphaValue = "1") {
	return `oklch(var(${colorVar}) / calc(${alphaValue} * <alpha-value>))`
}

const config = {
	darkMode: ["class"],
	content: [
		"./index.html",
		"./shared.html",
		"./search.html",
		"./dingtalk.html",
		"./src/**/*.{ts,tsx,js,jsx}",
		"./enterprise/src/**/*.{ts,tsx,js,jsx}",
		"./node_modules/@dtyq/user-selector/dist/**/*.js",
	],
	theme: {
		container: {
			center: true,
			padding: "1.5rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			zIndex: {
				popup: "var(--z-index-popup)",
				dialog: "var(--z-index-dialog)",
				dropdown: "var(--z-index-dropdown)",
				drawer: "var(--z-index-drawer)",
				tooltip: "var(--z-index-tooltip)",
				modal: "var(--z-index-modal)",
				select: "var(--z-index-select)",
			},
			height: {
				"mobile-tabbar": "var(--mobile-tabbar-height, 60px)",
			},
			padding: {
				"safe-top": "var(--safe-area-inset-top, env(safe-area-inset-top))",
				"safe-bottom": "var(--safe-area-inset-bottom, env(safe-area-inset-bottom))",
				"safe-left": "var(--safe-area-inset-left, env(safe-area-inset-left))",
				"safe-right": "var(--safe-area-inset-right, env(safe-area-inset-right))",
				"safe-bottom-with-tabbar":
					"calc(16px + var(--mobile-tabbar-height) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom)))",
			},
			margin: {
				"safe-top": "var(--safe-area-inset-top, env(safe-area-inset-top))",
				"safe-bottom": "var(--safe-area-inset-bottom, env(safe-area-inset-bottom))",
				"safe-left": "var(--safe-area-inset-left, env(safe-area-inset-left))",
				"safe-right": "var(--safe-area-inset-right, env(safe-area-inset-right))",
			},
			colors: {
				border: oklchColor("--border", "var(--border-alpha)"),
				input: oklchColor("--input", "var(--input-alpha)"),
				ring: oklchColor("--ring"),
				background: oklchColor("--background"),
				fill: oklchColor("--fill"),
				"fill-secondary": oklchColor("--fill-secondary", "var(--fill-secondary-alpha)"),
				foreground: {
					DEFAULT: oklchColor("--foreground"),
					blue: colors.blue[500],
					indigo: colors.indigo[500],
				},
				primary: {
					DEFAULT: oklchColor("--primary"),
					foreground: oklchColor("--primary-foreground"),
					10: "var(--custom-primary-10-dark-primary-20)",
				},
				secondary: {
					DEFAULT: oklchColor("--secondary"),
					foreground: oklchColor("--secondary-foreground"),
				},
				destructive: {
					DEFAULT: oklchColor("--destructive"),
					foreground: oklchColor("--destructive-foreground"),
					custom: "var(--custom-destructive-60)",
				},
				muted: {
					DEFAULT: oklchColor("--muted"),
					foreground: oklchColor("--muted-foreground"),
				},
				accent: {
					DEFAULT: oklchColor("--accent"),
					foreground: oklchColor("--accent-foreground"),
				},
				popover: {
					DEFAULT: oklchColor("--popover"),
					foreground: oklchColor("--popover-foreground"),
				},
				card: {
					DEFAULT: oklchColor("--card"),
					foreground: oklchColor("--card-foreground"),
				},
				chart: {
					1: oklchColor("--chart-1"),
					2: oklchColor("--chart-2"),
					3: oklchColor("--chart-3"),
					4: oklchColor("--chart-4"),
					5: oklchColor("--chart-5"),
				},
				sidebar: {
					DEFAULT: oklchColor("--sidebar"),
					foreground: oklchColor("--sidebar-foreground"),
					primary: oklchColor("--sidebar-primary"),
					"primary-foreground": oklchColor("--sidebar-primary-foreground"),
					accent: oklchColor("--sidebar-accent"),
					"accent-foreground": oklchColor("--sidebar-accent-foreground"),
					border: oklchColor("--sidebar-border", "var(--sidebar-border-alpha)"),
					ring: oklchColor("--sidebar-ring"),
				},
			},
			boxShadow: {
				// Tailwind v3 没有内置 shadow-xs，这里补充定义以对齐 v4 的语义
				// 值与 shadow-sm 相同：0 1px 2px 0 rgb(0 0 0 / 0.05)
				xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
			},
			borderRadius: {
				lg: "var(--radius-lg)",
				md: "var(--radius-md)",
				sm: "var(--radius-sm)",
				xl: "var(--radius-xl)",
				xs: "var(--radius-xs, 0.125rem)", // 2px
			},
			keyframes: {
				"slide-in-from-left": {
					from: { transform: "translateX(-100%)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"slide-in-from-right": {
					from: { transform: "translateX(100%)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"voice-wave": {
					"0%, 100%": { transform: "scaleY(1)" },
					"50%": { transform: "scaleY(0.5)" },
				},
				"skeleton-loading": {
					"0%": { backgroundPosition: "100% 0" },
					"100%": { backgroundPosition: "-100% 0" },
				},
				fadeInUp: {
					from: { transform: "translateY(20px)", opacity: "0" },
					to: { transform: "translateY(0)", opacity: "1" },
				},
				"super-magic-message-enter-subtle": {
					"0%": {
						opacity: "0",
						transform: "translate3d(0, 10px, 0) scale(0.992)",
					},
					"35%": {
						opacity: "0.38",
						transform: "translate3d(0, 5px, 0) scale(0.996)",
					},
					"65%": {
						opacity: "0.82",
						transform: "translate3d(0, -1px, 0) scale(1.001)",
					},
					"100%": {
						opacity: "1",
						transform: "translate3d(0, 0, 0) scale(1)",
					},
				},
				"super-magic-message-enter-default": {
					"0%": {
						opacity: "0",
						transform: "translate3d(0, 14px, 0) scale(0.985)",
					},
					"40%": {
						opacity: "0.4",
						transform: "translate3d(0, 7px, 0) scale(0.992)",
					},
					"70%": {
						opacity: "0.84",
						transform: "translate3d(0, -1.5px, 0) scale(1.002)",
					},
					"100%": {
						opacity: "1",
						transform: "translate3d(0, 0, 0) scale(1)",
					},
				},
				"super-magic-message-enter-emphasis": {
					"0%": {
						opacity: "0",
						transform: "translate3d(0, 18px, 0) scale(0.98)",
					},
					"42%": {
						opacity: "0.36",
						transform: "translate3d(0, 9px, 0) scale(0.99)",
					},
					"72%": {
						opacity: "0.82",
						transform: "translate3d(0, -2px, 0) scale(1.003)",
					},
					"100%": {
						opacity: "1",
						transform: "translate3d(0, 0, 0) scale(1)",
					},
				},
				blink: {
					"0%, 50%": { opacity: "1" },
					"51%, 100%": { opacity: "0" },
				},
				scan: {
					"0%": { transform: "translateX(0)" },
					"100%": { transform: "translateX(400px)" },
				},
				"gradient-flow": {
					"0%": { backgroundPosition: "200% 0%" },
					"100%": { backgroundPosition: "-200% 0%" },
				},
			},
			animation: {
				"slide-in-from-left": "slide-in-from-left 0.3s ease-out",
				"slide-in-from-right": "slide-in-from-right 0.3s ease-out",
				"voice-wave": "voice-wave 1.2s ease-in-out infinite",
				skeleton: "skeleton-loading 1.5s ease-in-out infinite",
				fadeInUp: "fadeInUp 0.5s ease-out",
				"super-magic-message-enter-subtle":
					"super-magic-message-enter-subtle 380ms cubic-bezier(0.16, 1, 0.3, 1) both",
				"super-magic-message-enter-default":
					"super-magic-message-enter-default 520ms cubic-bezier(0.16, 1, 0.3, 1) both",
				"super-magic-message-enter-emphasis":
					"super-magic-message-enter-emphasis 560ms cubic-bezier(0.16, 1, 0.3, 1) both",
				blink: "blink 1s steps(1, end) infinite",
				scan: "scan 2s linear infinite",
				"gradient-flow": "gradient-flow 20s linear infinite",
			},
			fontFamily: {
				poppins: ["Poppins", "sans-serif"],
			},
		},
	},
	plugins: [animate],
}

export default config
