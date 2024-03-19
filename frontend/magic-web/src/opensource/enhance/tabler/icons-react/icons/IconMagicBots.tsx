import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconMagicBots = memo(({ stroke = 1.5, color, size = 20 }: IconProps) => {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<path
				d="M12 6.0368C6.3811 6.0368 3 9.62959 3 14.0615C3 18.4934 6.3811 20.6906 12 20.6906C17.6189 20.6906 21 18.4934 21 14.0615C21 9.62959 17.6189 6.0368 12 6.0368ZM12 6.0368C12 5.37014 12.5 3.5 14 3.5M9 11.5955V14.5955M15 11.5955V14.5955"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
			/>
		</svg>
	)
})

export default IconMagicBots
