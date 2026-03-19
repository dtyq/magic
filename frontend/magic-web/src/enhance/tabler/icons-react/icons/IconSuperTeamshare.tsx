import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"
const IconSuperTeamshare = memo(({ size = 20, color }: IconProps) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g id="tabler-icon-super-teamshare">
				<path
					id="Vector 2"
					d="M15.4722 5.92593L15.7924 4.86005C15.9244 4.35115 15.8122 3.33333 14.3072 3.33333C12.8022 3.33333 8.72948 3.33333 6.88124 3.33333C6.25416 3.43512 5 4.10687 5 5.97964C5 7.85242 6.25416 8.38847 6.88124 8.42239H15.0003L12.822 15.5471C12.723 15.9203 12.2279 16.6667 11.0398 16.6667C9.85163 16.6667 9.09253 16.6667 8.76249 16.6667C7.77236 16.6667 7.67335 16.1578 7.77236 15.8524C7.87255 15.5434 8.51016 13.0761 8.97222 11.4815"
					stroke={color ?? "currentColor"}
					strokeOpacity="0.8"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</g>
		</svg>
	)
})

export default IconSuperTeamshare
