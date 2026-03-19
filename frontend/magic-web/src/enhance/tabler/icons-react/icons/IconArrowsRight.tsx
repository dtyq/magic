import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconArrowsRight({ size, strokeWidth }: IconProps) {
	return (
		<svg viewBox="0 0 48 48" width={size} height={size} fill="none">
			<path
				d="M19 12L31 24L19 36"
				stroke="#333"
				strokeWidth={strokeWidth ?? 2}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconArrowsRight)
