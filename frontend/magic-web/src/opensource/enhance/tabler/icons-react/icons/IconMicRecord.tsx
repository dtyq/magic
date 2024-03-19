import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconMicRecord = ({ size = 24, stroke = 1.5, color }: IconProps) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			shapeRendering="geometricPrecision"
		>
			{/* Main microphone body */}
			<path
				d="M9 5C9 4.2 9.3 3.4 9.9 2.9C10.4 2.3 11.2 2 12 2C12.8 2 13.6 2.3 14.1 2.9C14.7 3.4 15 4.2 15 5V10C15 10.8 14.7 11.6 14.1 12.1C13.6 12.7 12.8 13 12 13C11.2 13 10.4 12.7 9.9 12.1C9.3 11.6 9 10.8 9 10V5Z"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			{/* Sound waves */}
			<path
				d="M5 10C5 11.9 5.7 13.6 7.1 14.9C8.4 16.3 10.1 17 12 17"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			{/* Base line */}
			<path
				d="M8 21H12"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			{/* Vertical line */}
			<path
				d="M12 17V21"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			{/* Recording indicator circle */}
			<circle
				cx="19"
				cy="19"
				r="3"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				fill="none"
			/>
		</svg>
	)
}

export default memo(IconMicRecord)
