import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconPhone = memo(({ size }: IconProps) => {
	return (
		<svg width={size} height={size} viewBox={`0 0 20 20`} fill="none">
			<rect x="2.75" y="1" width="14" height="18" rx="2" fill="#FFC900" />
			<circle cx="9.75" cy="17" r="1" fill="white" />
			<rect opacity="0.4" x="3.75" y="2" width="12" height="13" rx="1" fill="white" />
		</svg>
	)
})

export default IconPhone
