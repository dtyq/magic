import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconCheckTick = memo(({ color, size }: IconProps) => {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M14.2338 2.84289C14.6884 3.15645 14.8028 3.77919 14.4892 4.23384L7.82257 13.9005C7.65036 14.1502 7.37413 14.3082 7.0716 14.3302C6.76908 14.3521 6.47295 14.2355 6.26656 14.0132L1.93323 9.34656C1.55742 8.94185 1.58086 8.30912 1.98557 7.93331C2.39028 7.55751 3.02301 7.58095 3.39881 7.98566L6.88388 11.7388L12.8428 3.09837C13.1564 2.64373 13.7791 2.52934 14.2338 2.84289Z"
				fill={color ?? "currentColor"}
				fillOpacity="0.6"
			/>
		</svg>
	)
})

export default IconCheckTick
