import { useEffect, type CSSProperties } from "react"
import type { DesignStyle } from "./catalog"
import DesignStyleLandingPage, { resolveLayout, resolveScene } from "./DesignStyleLandingPage"
import { loadGoogleFonts } from "./googleFontLoader"
import { getSceneTheme } from "./sceneTheme"

export type SceneViewport = "desktop" | "tablet" | "mobile"

interface DesignStyleSceneProps {
	style: DesignStyle
	viewport?: SceneViewport
	compact?: boolean
	loadFonts?: boolean
}

/**
 * The scene owns the style variables and viewport contract; the page renderer
 * is deliberately data-only so DESIGN.md content can never become executable
 * markup or CSS.
 */
export default function DesignStyleScene({
	style,
	viewport = "desktop",
	compact = false,
	loadFonts = true,
}: DesignStyleSceneProps) {
	const theme = getSceneTheme(style)
	const scene = resolveScene(style)
	const layout = resolveLayout(style)
	useEffect(() => {
		if (loadFonts) void loadGoogleFonts(theme.font)
	}, [loadFonts, theme.font])

	return (
		<div
			style={{ ...theme.variables, containerType: "inline-size" } as CSSProperties}
			data-testid={`design-style-scene-${style.code}`}
			data-scene={scene}
			data-layout={layout}
			data-viewport={viewport}
			className={`overflow-hidden bg-[var(--scene-bg)] text-[var(--scene-ink)] ${compact ? "pointer-events-none select-none" : ""}`}
		>
			<DesignStyleLandingPage style={style} viewport={viewport} compact={compact} />
		</div>
	)
}
