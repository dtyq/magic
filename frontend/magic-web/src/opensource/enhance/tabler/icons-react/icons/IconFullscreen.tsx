import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconFullscreen = memo(({ size = 16, stroke = 1.25, color = "currentColor" }: IconProps) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M2 4.66667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H4.66667M11.3333 2H12.6667C13.0203 2 13.3594 2.14048 13.6095 2.39052C13.8595 2.64057 14 2.97971 14 3.33333V4.66667M14 11.3333V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H11.3333M4.66667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V11.3333M5.33333 5.33333H10.6667C11.0349 5.33333 11.3333 5.63181 11.3333 6V10C11.3333 10.3682 11.0349 10.6667 10.6667 10.6667H5.33333C4.96514 10.6667 4.66667 10.3682 4.66667 10V6C4.66667 5.63181 4.96514 5.33333 5.33333 5.33333Z"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

IconFullscreen.displayName = "IconFullscreen"
export default IconFullscreen
