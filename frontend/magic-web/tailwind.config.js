import animate from "tailwindcss-animate"
import colors from "tailwindcss/colors"
import plugin from "tailwindcss/plugin"

function rgbColor(colorVar, alphaValue = "1") {
	return `rgb(var(${colorVar}-rgb) / calc(${alphaValue} * <alpha-value>))`
}

const config = {
	darkMode: ["class"],
	future: {
		hoverOnlyWhenSupported: true,
	},
	content: {
		relative: true,
		files: [
			"./index.html",
			"./shared.html",
			"./search.html",
			"./dingtalk.html",
			"./src/**/*.{ts,tsx,jsx}",
			"./enterprise/src/**/*.{ts,tsx,jsx}",
			"./packages/magic-admin-v2/src/**/*.{ts,tsx,jsx}",
			"!./src/**/node_modules/**",
			"!./enterprise/src/**/node_modules/**",
			"./node_modules/@dtyq/user-selector/dist/**/*.js",
		],
	},
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
				"context-menu": "var(--z-index-context-menu)",
				"detail-fullscreen": "var(--z-index-detail-fullscreen)",
				popup: "var(--z-index-popup)",
				dialog: "var(--z-index-dialog)",
				dropdown: "var(--z-index-dropdown)",
				drawer: "var(--z-index-drawer)",
				tooltip: "var(--z-index-tooltip)",
				modal: "var(--z-index-modal)",
				select: "var(--z-index-select)",
				sheet: "var(--z-index-sheet)",
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
				border: rgbColor("--border", "var(--border-alpha)"),
				input: rgbColor("--input", "var(--input-alpha)"),
				ring: rgbColor("--ring"),
				background: rgbColor("--background"),
				"mobile-background": rgbColor("--mobile-background"),
				"mobile-shell-track": rgbColor("--mobile-shell-track"),
				fill: rgbColor("--fill"),
				"fill-secondary": rgbColor("--fill-secondary", "var(--fill-secondary-alpha)"),
				foreground: {
					DEFAULT: rgbColor("--foreground"),
					blue: colors.blue[500],
					indigo: colors.indigo[500],
				},
				primary: {
					DEFAULT: rgbColor("--primary"),
					foreground: rgbColor("--primary-foreground"),
					10: "var(--custom-primary-10-dark-primary-20)",
				},
				secondary: {
					DEFAULT: rgbColor("--secondary"),
					foreground: rgbColor("--secondary-foreground"),
				},
				destructive: {
					DEFAULT: rgbColor("--destructive"),
					foreground: rgbColor("--destructive-foreground"),
					custom: "var(--custom-destructive-60)",
				},
				muted: {
					DEFAULT: rgbColor("--muted"),
					foreground: rgbColor("--muted-foreground"),
				},
				info: rgbColor("--info"),
				"info-foreground": rgbColor("--info-foreground"),
				warning: {
					DEFAULT: rgbColor("--warning"),
					foreground: rgbColor("--warning-foreground"),
				},
				success: {
					DEFAULT: rgbColor("--success"),
					foreground: rgbColor("--success-foreground"),
				},
				"icon-workspace": rgbColor("--icon-workspace"),
				"icon-project": rgbColor("--icon-project"),
				"icon-topic": rgbColor("--icon-topic"),
				"icon-chat": rgbColor("--icon-chat"),
				"icon-recording": rgbColor("--icon-recording"),
				"icon-app-knowledge": rgbColor("--icon-app-knowledge"),
				"icon-app-cloud": rgbColor("--icon-app-cloud"),
				"icon-app-approval": rgbColor("--icon-app-approval"),
				"icon-app-bookmarks": rgbColor("--icon-app-bookmarks"),
				accent: {
					DEFAULT: rgbColor("--accent"),
					foreground: rgbColor("--accent-foreground"),
				},
				popover: {
					DEFAULT: rgbColor("--popover"),
					foreground: rgbColor("--popover-foreground"),
				},
				card: {
					DEFAULT: rgbColor("--card"),
					foreground: rgbColor("--card-foreground"),
				},
				chart: {
					1: rgbColor("--chart-1"),
					2: rgbColor("--chart-2"),
					3: rgbColor("--chart-3"),
					4: rgbColor("--chart-4"),
					5: rgbColor("--chart-5"),
				},
				sidebar: {
					DEFAULT: rgbColor("--sidebar"),
					foreground: rgbColor("--sidebar-foreground"),
					primary: rgbColor("--sidebar-primary"),
					"primary-foreground": rgbColor("--sidebar-primary-foreground"),
					accent: rgbColor("--sidebar-accent"),
					"accent-foreground": rgbColor("--sidebar-accent-foreground"),
					border: rgbColor("--sidebar-border", "var(--sidebar-border-alpha)"),
					ring: rgbColor("--sidebar-ring"),
				},
			},
			boxShadow: {
				// Tailwind v3 没有内置 shadow-xs，这里补充定义以对齐 v4 的语义
				// 值与 shadow-sm 相同：0 1px 2px 0 rgb(0 0 0 / 0.05)
				xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
				/** Mobile floating round buttons — see --magic-floating-action-shadow in index.css */
				"magic-floating-action": "var(--magic-floating-action-shadow)",
				/** Bottom-docked cards (composer) — upward-biased; see --magic-mobile-dock-surface-shadow */
				"mobile-dock-surface": "var(--magic-mobile-dock-surface-shadow)",
			},
			borderRadius: {
				lg: "var(--radius-lg)",
				md: "var(--radius-md)",
				sm: "var(--radius-sm)",
				xl: "var(--radius-xl)",
				xs: "var(--radius-xs, 0.125rem)", // 2px
				// 4xl: prototype scale beyond Tailwind's built-in 3xl (1.5rem); 2xl/3xl left to Tailwind defaults to avoid overriding PC usage
				"4xl": "var(--radius-4xl)",
			},
			// Prototype (Tailwind v4) uses bg-icon-*/8 for 8% tint; v3 default opacity scale has no "8".
			opacity: {
				8: "0.08",
			},
			keyframes: {
				"sidebar-icon-stroke": {
					from: { strokeDashoffset: "100" },
					to: { strokeDashoffset: "0" },
				},
				"slide-in-from-left": {
					from: { transform: "translateX(-100%)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"slide-in-from-right": {
					from: { transform: "translateX(100%)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"drawer-slide-in-left": {
					from: { transform: "translateX(-100%)" },
					to: { transform: "translateX(0)" },
				},
				"drawer-slide-in-right": {
					from: { transform: "translateX(100%)" },
					to: { transform: "translateX(0)" },
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
				scaleIn: {
					from: { transform: "scale(0.6)", opacity: "0" },
					to: { transform: "scale(1)", opacity: "1" },
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
				"maintenance-notice-marquee": {
					"0%": { transform: "translateX(0)" },
					"100%": { transform: "translateX(-50%)" },
				},
			},
			animation: {
				"sidebar-icon-stroke": "sidebar-icon-stroke 1.5s forwards",
				"slide-in-from-left": "slide-in-from-left 0.3s ease-out",
				"slide-in-from-right": "slide-in-from-right 0.3s ease-out",
				"drawer-slide-in-left": "drawer-slide-in-left 0.2s ease-out",
				"drawer-slide-in-right": "drawer-slide-in-right 0.2s ease-out",
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
				"spin-slow": "spin 1.5s linear infinite",
				"maintenance-notice-marquee":
					"maintenance-notice-marquee var(--maintenance-notice-duration, 18s) linear infinite",
			},
			fontFamily: {
				poppins: ["Poppins", "sans-serif"],
			},
		},
	},
	plugins: [
		animate,
		plugin(({ addVariant }) => {
			// Keep compound desktop queries out of `theme.screens`: Tailwind 3.4 disables
			// every `min-*`/`max-*` variant when any configured screen is an object.
			addVariant(
				"desktop-compact",
				"@media (min-width: 768px) and (min-height: 721px) and (max-height: 800px)",
			)
			addVariant("desktop-short", "@media (min-width: 768px) and (max-height: 720px)")
			addVariant("desktop-narrow", "@media (min-width: 768px) and (max-width: 1199px)")
			// Desktop layout and input capability are separate: iPad can render desktop UI while still using coarse touch input.
			addVariant("no-hover", "@media (hover: none) and (pointer: coarse)")
		}),
	],
}

export default config
