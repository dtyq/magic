import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconMagicDoc = memo(({ size = 24 }: IconProps) => {
	const scale = Number(size) / 24
	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M15.763 0L23 7.237V22C23 22.5304 22.7893 23.0391 22.4142 23.4142C22.0391 23.7893 21.5304 24 21 24H3C2.46957 24 1.96086 23.7893 1.58579 23.4142C1.21071 23.0391 1 22.5304 1 22V2C1 1.46957 1.21071 0.960859 1.58579 0.585786C1.96086 0.210714 2.46957 0 3 0L15.763 0Z"
				fill="#4B4B4B"
				transform={`scale(${scale})`}
			/>
			<path
				d="M17.763 7.237C17.2326 7.237 16.7239 7.02629 16.3488 6.65121C15.9737 6.27614 15.763 5.76743 15.763 5.237V0L23 7.237H17.763Z"
				fill="white"
				fillOpacity="0.401"
				transform={`scale(${scale})`}
			/>
			<path
				d="M18.394 18.54H5.60602C5.1918 18.54 4.85602 18.8758 4.85602 19.29C4.85602 19.7042 5.1918 20.04 5.60602 20.04H18.394C18.8082 20.04 19.144 19.7042 19.144 19.29C19.144 18.8758 18.8082 18.54 18.394 18.54Z"
				fill="white"
				transform={`scale(${scale})`}
			/>
			<path
				d="M11.25 13.499H5.60602C5.1918 13.499 4.85602 13.8348 4.85602 14.249C4.85602 14.6632 5.1918 14.999 5.60602 14.999H11.25C11.6642 14.999 12 14.6632 12 14.249C12 13.8348 11.6642 13.499 11.25 13.499Z"
				fill="white"
				transform={`scale(${scale})`}
			/>
		</svg>
	)
})

IconMagicDoc.displayName = "IconMagicDoc"
export default IconMagicDoc
