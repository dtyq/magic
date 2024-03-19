import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconEmail({ size }: IconProps) {
	return (
		<svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
			<rect x="1" y="2" width="18" height="15" rx="2" fill="#FF5500" />
			<path
				opacity="0.5"
				d="M17 2C18.1046 2 19 2.89543 19 4V5.21387L12.1631 9.60938C10.8455 10.4564 9.15454 10.4564 7.83691 9.60938L1 5.21387V4C1 2.89543 1.89543 2 3 2H17Z"
				fill="white"
			/>
		</svg>
	)
}

export default memo(IconEmail)
