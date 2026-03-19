import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconWindowOpen = memo(
	({ size = 24, stroke = 1.5, color = "currentColor", className }: IconProps) => {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={className}
			>
				<path
					d="M21 15V20C21 20.2652 20.8946 20.5196 20.7071 20.7071C20.5196 20.8946 20.2652 21 20 21H4C3.73478 21 3.48043 20.8946 3.29289 20.7071C3.10536 20.5196 3 20.2652 3 20V4C3 3.73478 3.10536 3.48043 3.29289 3.29289C3.48043 3.10536 3.73478 3 4 3H9M15 3H21M21 3V9M21 3L12 12"
					stroke={color}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		)
	},
)

IconWindowOpen.displayName = "IconWindowOpen"

export default IconWindowOpen
