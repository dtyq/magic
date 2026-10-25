import type { DesignStyle } from "./catalog"
import DesignStyleArtwork from "./DesignStyleArtwork"
import { getSceneTheme } from "./sceneTheme"
import { getStyleProfile } from "./styleProfiles"

export default function DesignStyleCover({ style }: { style: DesignStyle }) {
	const profile = getStyleProfile(style.code)
	const theme = getSceneTheme(style)
	const name = profile?.name.en ?? style.title
	const words = name.split(/\s+/)
	const lines: string[] = [""]
	for (const word of words) {
		const last = lines.length - 1
		if (lines[last] && `${lines[last]} ${word}`.length > 22) lines.push(word)
		else lines[last] = `${lines[last]} ${word}`.trim()
	}
	const stacked = profile?.layout === "stacked" || profile?.layout === "grid"
	// Covers deliberately use local fallbacks; browsing 176 styles must not load 176 web fonts.
	const fontFamily = profile?.features.includes("serif-type")
		? 'Georgia, "Songti SC", serif'
		: profile?.features.includes("mono-type")
			? "ui-monospace, monospace"
			: 'system-ui, "PingFang SC", sans-serif'
	return (
		<svg
			viewBox="0 0 800 500"
			aria-hidden="true"
			focusable="false"
			className="block size-full"
			style={{ ...theme.variables, fontFamily }}
		>
			<rect width="800" height="500" fill="var(--scene-bg)" />
			{profile?.features.includes("bold-borders") && (
				<rect
					x="16"
					y="16"
					width="768"
					height="468"
					fill="none"
					stroke="var(--scene-ink)"
					strokeWidth="4"
				/>
			)}
			<text
				x="56"
				y="96"
				fill="var(--scene-ink)"
				fontSize={Math.min(
					86,
					660 / (Math.max(...lines.map((line) => line.length), 1) * 0.75),
				)}
				fontWeight={profile?.features.includes("oversized-type") ? 700 : 500}
				letterSpacing="-1.8"
			>
				{lines.slice(0, 3).map((line, index) => (
					<tspan key={index} x="56" dy={index ? 64 : 0}>
						{line}
					</tspan>
				))}
			</text>
			<g
				transform={
					stacked ? "translate(330 170) scale(.95)" : "translate(420 170) scale(.95)"
				}
			>
				<DesignStyleArtwork profile={profile} />
			</g>
			<path d="M56 407H106" stroke="var(--scene-primary)" strokeWidth="3" />
			<text x="56" y="444" fill="var(--scene-muted)" fontSize="20">
				{profile?.name.zh ?? style.title}
			</text>
		</svg>
	)
}
