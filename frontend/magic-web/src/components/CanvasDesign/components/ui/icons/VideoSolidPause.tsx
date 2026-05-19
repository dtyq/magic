import type { LucideProps } from "lucide-react"
import {
	getVideoPauseBarRectsNormalized,
	VIDEO_PAUSE_ICON_VIEWBOX,
} from "../../../canvas/element/elements/videoPlayIconPath"

/** 视频暂停实心条，与画布 VideoRenderer 布局一致 */
export default function VideoSolidPause({
	size = 16,
	color = "currentColor",
	className,
	...props
}: LucideProps) {
	const rects = getVideoPauseBarRectsNormalized()
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox={VIDEO_PAUSE_ICON_VIEWBOX}
			fill="none"
			className={className}
			{...props}
		>
			{rects.map((r, i) => (
				<rect
					key={i}
					x={r.x}
					y={r.y}
					width={r.width}
					height={r.height}
					rx={r.rx}
					fill={color}
				/>
			))}
		</svg>
	)
}
