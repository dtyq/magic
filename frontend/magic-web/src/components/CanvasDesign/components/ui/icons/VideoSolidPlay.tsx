import type { LucideProps } from "lucide-react"
import {
	LUCIDE_PLAY_SOLID_PATH_D,
	LUCIDE_PLAY_VIEWBOX,
} from "../../../canvas/element/elements/videoPlayIconPath"

/** 视频播放实心图标：Lucide play 路径 + fill（与 demo.svg 同源） */
export default function VideoSolidPlay({
	size = 16,
	color = "currentColor",
	className,
	...props
}: LucideProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox={LUCIDE_PLAY_VIEWBOX}
			fill="none"
			className={className}
			{...props}
		>
			<path d={LUCIDE_PLAY_SOLID_PATH_D} fill={color} />
		</svg>
	)
}
