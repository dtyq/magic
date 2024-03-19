import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconEllipsis = memo(({ size = 24 }: IconProps) => {
	const height = Number(size)
	const width = (height * 23) / 16
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect
				y="0.5"
				width={width}
				height={(width * 15) / 23}
				rx="4"
				fill="#1C1D23"
				fillOpacity="0.35"
			/>
			<circle cx="6.5" cy="8" r="1.5" fill="white" />
			<circle cx="11.5" cy="8" r="1.5" fill="white" />
			<circle cx="16.5" cy="8" r="1.5" fill="white" />
		</svg>
	)
})

IconEllipsis.displayName = "IconEllipsis"
export default IconEllipsis
