import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconShareCog = ({ size = 20, stroke = 1.5, color = "#0A0A0A" }: IconProps) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M11.0001 14.5C5.87128 14.5427 1.95921 21.226 2.00032 20.9943C3.0892 15.1327 5.80584 8.65472 13.1113 7.49858V3L21 10M20.2 14L19.8 14.9M17.5999 20.5L17.1999 21.4M22.3999 19.2L21.4999 18.8M15.8999 16.6L14.9999 16.2M22.3999 16.2L21.4999 16.6M15.8999 18.8L14.9999 19.2M20.2 21.4L19.8 20.5M17.5999 14.9L17.1999 14M21.6999 17.7C21.6999 19.3568 20.3568 20.7 18.6999 20.7C17.043 20.7 15.6999 19.3568 15.6999 17.7C15.6999 16.0431 17.043 14.7 18.6999 14.7C20.3568 14.7 21.6999 16.0431 21.6999 17.7Z"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconShareCog)
