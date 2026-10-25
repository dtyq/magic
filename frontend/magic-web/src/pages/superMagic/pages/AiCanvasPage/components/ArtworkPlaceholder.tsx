import { memo, useId } from "react"
import type { ShowcaseKind } from "../showcase"

const PALETTES: Record<ShowcaseKind, [string, string, string]> = {
	poster: ["#ffb199", "#ff6a88", "#2b1055"],
	character: ["#a1c4fd", "#c2e9fb", "#5b6ee1"],
	storyboard: ["#fbc2eb", "#a6c1ee", "#334155"],
	product: ["#fdfcfb", "#e2d1c3", "#8d6e63"],
}

interface ArtworkPlaceholderProps {
	kind: ShowcaseKind
	className?: string
}

/**
 * Vector stand-in for an artwork while no real image is available: a sunset poster, a
 * character silhouette, a storyboard landscape or a product on a plinth. Pure SVG keeps it
 * crisp at any card size and needs no binary asset.
 */
function ArtworkPlaceholder({ kind, className }: ArtworkPlaceholderProps) {
	// Gradient ids must be unique per instance because several placeholders share the page.
	const id = useId().replace(/:/g, "")
	const [light, mid, deep] = PALETTES[kind]

	return (
		<svg
			viewBox="0 0 300 400"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<defs>
				<linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={light} />
					<stop offset="60%" stopColor={mid} />
					<stop offset="100%" stopColor={deep} />
				</linearGradient>
				<radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="50%">
					<stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
					<stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
				</radialGradient>
			</defs>
			<rect width="300" height="400" fill={`url(#${id}-sky)`} />
			{kind === "poster" ? (
				<>
					<circle cx="150" cy="190" r="70" fill="#fff4d6" opacity="0.9" />
					<path
						d="M0 290 L80 230 L150 280 L230 210 L300 260 L300 400 L0 400Z"
						fill={deep}
						opacity="0.85"
					/>
					<rect x="40" y="40" width="120" height="10" rx="5" fill="#fff" opacity="0.8" />
					<rect x="40" y="58" width="80" height="6" rx="3" fill="#fff" opacity="0.6" />
				</>
			) : null}
			{kind === "character" ? (
				<>
					<circle cx="150" cy="170" r="110" fill={`url(#${id}-glow)`} />
					<circle cx="150" cy="150" r="46" fill={deep} opacity="0.9" />
					<path d="M70 400 C 80 260, 220 260, 230 400Z" fill={deep} opacity="0.9" />
				</>
			) : null}
			{kind === "storyboard" ? (
				<>
					<circle cx="220" cy="120" r="34" fill="#fff" opacity="0.75" />
					<path
						d="M0 270 C 80 220, 160 300, 300 240 L300 400 L0 400Z"
						fill={deep}
						opacity="0.7"
					/>
					<path
						d="M0 320 C 100 280, 200 340, 300 300 L300 400 L0 400Z"
						fill={deep}
						opacity="0.95"
					/>
				</>
			) : null}
			{kind === "product" ? (
				<>
					<circle cx="150" cy="200" r="120" fill={`url(#${id}-glow)`} />
					<rect
						x="60"
						y="300"
						width="180"
						height="40"
						rx="6"
						fill={deep}
						opacity="0.35"
					/>
					<rect
						x="118"
						y="140"
						width="64"
						height="160"
						rx="22"
						fill={deep}
						opacity="0.9"
					/>
					<rect x="134" y="112" width="32" height="34" rx="8" fill={deep} />
				</>
			) : null}
		</svg>
	)
}

export default memo(ArtworkPlaceholder)
