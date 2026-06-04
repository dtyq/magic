/** Supported background tokens for scroll edge fade gradients. */
export type ScrollEdgeFadeColor = "muted" | "background" | "mobile-background"

/**
 * Tailwind `from-*` utility for each fade token (matches page `bg-*` semantics via theme rgbColor).
 */
export const scrollEdgeFadeFromClass: Record<ScrollEdgeFadeColor, string> = {
	muted: "from-muted",
	background: "from-background",
	"mobile-background": "from-mobile-background",
}

/**
 * Maps fade color tokens to RGB CSS values (legacy / non-Tailwind consumers).
 */
export function getScrollEdgeFadeRgb(fadeColor: ScrollEdgeFadeColor): string {
	if (fadeColor === "muted") return "rgb(var(--muted-rgb) / 1)"
	if (fadeColor === "mobile-background") return "rgb(var(--mobile-background-rgb) / 1)"
	return "rgb(var(--background-rgb) / 1)"
}

/**
 * Builds top/bottom linear-gradient backgrounds for scroll edge masks.
 */
export function getScrollEdgeFadeGradients(fadeColor: ScrollEdgeFadeColor): {
	top: string
	bottom: string
} {
	const rgb = getScrollEdgeFadeRgb(fadeColor)
	return {
		top: `linear-gradient(to bottom, ${rgb} 0%, transparent 100%)`,
		bottom: `linear-gradient(to top, ${rgb} 0%, transparent 100%)`,
	}
}
