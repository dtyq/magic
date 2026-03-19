import type * as React from "react"
import { createAnimation } from "../helpers/animation"
import type { LoaderHeightWidthRadiusProps } from "../types"
import { cssValue } from "../helpers/unitConverter"

const scale = createAnimation(
	"ScaleLoader",
	"0% {transform: scaley(1.0)} 50% {transform: scaley(0.4)} 100% {transform: scaley(1.0)}",
	"scale",
)

function ScaleLoader({
	loading = true,
	color = "rgba(28, 29, 35, 0.35)",
	speedMultiplier = 1,
	cssOverride = {},
	height = 10,
	width = 2,
	radius = 1,
	margin = 1,
	...additionalprops
}: LoaderHeightWidthRadiusProps): JSX.Element | null {
	const wrapper: React.CSSProperties = {
		display: "inherit",
		...cssOverride,
	}

	const style = (i: number): React.CSSProperties => {
		return {
			backgroundColor: color,
			width: cssValue(width),
			height: cssValue(height),
			margin: cssValue(margin),
			borderRadius: cssValue(radius),
			display: "inline-block",
			animation: `${scale} ${1 / speedMultiplier}s ${i * 0.1}s infinite cubic-bezier(0.2, 0.68, 0.18, 1.08)`,
			animationFillMode: "both",
		}
	}

	if (!loading) {
		return null
	}

	return (
		<span style={wrapper} {...additionalprops}>
			<span style={style(1)} />
			<span style={style(3)} />
			<span style={style(1)} />
			<span style={style(3)} />
			<span style={style(1)} />
		</span>
	)
}

export default ScaleLoader
