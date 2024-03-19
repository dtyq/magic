import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

export type IconTickProps = IconProps

const IconTick = memo(({ color = "#315CEC", size = 16, style, className }: IconTickProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 17 17"
			fill="none"
			style={style}
			className={className}
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M14.7345 3.34351C15.1891 3.65706 15.3035 4.2798 14.99 4.73445L8.3233 14.4011C8.15109 14.6508 7.87486 14.8089 7.57234 14.8308C7.26981 14.8527 6.97369 14.7361 6.76729 14.5138L2.43396 9.84717C2.05816 9.44246 2.08159 8.80973 2.4863 8.43392C2.89101 8.05812 3.52374 8.08156 3.89955 8.48627L7.38462 12.2394L13.3435 3.59899C13.6571 3.14434 14.2798 3.02995 14.7345 3.34351Z"
				fill={color ?? "currentColor"}
			/>
		</svg>
	)
})

export default IconTick
