import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconVoice = memo(({ stroke = 1.5, color, size }: IconProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
		>
			<path
				d="M7.99951 11.657L7.99951 11.667M10.8274 8.82899C11.5773 9.57911 11.9985 10.5963 11.9985 11.657C11.9985 12.7177 11.5773 13.7349 10.8274 14.485M13.6567 6C14.3996 6.74287 14.9889 7.62481 15.391 8.59544C15.7931 9.56607 16 10.6064 16 11.657C16 12.7076 15.7931 13.7479 15.391 14.7186C14.9889 15.6892 14.3996 16.5711 13.6567 17.314"
				stroke={color}
				strokeOpacity="0.8"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

export default IconVoice
