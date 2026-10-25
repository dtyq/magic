import type { HypothesisVerdict, ThemeConfidence } from "../types"

/**
 * Raised card on the research canvas: white surface, soft shadow and a hairline ring instead
 * of a hard border, so cards separate from the gray canvas without adding more lines.
 */
export const CARD_SURFACE =
	"rounded-xl bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_2px_8px_-2px_rgb(0_0_0/0.05)] ring-1 ring-border/60"

/** Left accent colour per verdict; the colour carries the conclusion before any text is read. */
export const VERDICT_ACCENT: Record<HypothesisVerdict, string> = {
	supported: "bg-emerald-500",
	refuted: "bg-rose-500",
	mixed: "bg-amber-400",
	insufficient: "bg-slate-300 dark:bg-slate-600",
	pending: "bg-border",
}

/** Left accent colour per theme confidence. */
export const CONFIDENCE_ACCENT: Record<ThemeConfidence, string> = {
	high: "bg-emerald-500",
	medium: "bg-sky-500",
	low: "bg-slate-300 dark:bg-slate-600",
	to_validate: "bg-amber-400",
}

/**
 * Motion vocabulary for the research pages: one ease-out curve for anything that moves or
 * resizes, a short press scale for anything clickable. Durations follow the role: 160ms for
 * press and colour, 220ms for fades and sliding thumbs, 500–600ms for bars and counts that grow.
 * Transform-based so it works on the Chrome 100 baseline (no individual `scale` property).
 */
export const EASE_OUT = "[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
export const PRESSABLE =
	"transition-transform duration-150 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] motion-reduce:transform-none"
