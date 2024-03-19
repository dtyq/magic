import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconCircleKeyboard = memo((props: IconProps) => {
	const { stroke = 1.5, color, size, ...rest } = props
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 28 28"
			fill="none"
			{...rest}
		>
			<path
				d="M8.75 14V14.0088M12.25 14V14.0088M15.75 14V14.0088M19.25 14V14.0088M10.5 17.5L17.5 17.5088M8.75 10.5V10.5088M12.25 10.5V10.5088M15.75 10.5V10.5088M19.25 10.5V10.5088M24.5 14C24.5 19.799 19.799 24.5 14 24.5C8.20101 24.5 3.5 19.799 3.5 14C3.5 8.20101 8.20101 3.5 14 3.5C19.799 3.5 24.5 8.20101 24.5 14Z"
				stroke={color ?? "currentColor"}
				strokeOpacity="0.8"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

export default IconCircleKeyboard
