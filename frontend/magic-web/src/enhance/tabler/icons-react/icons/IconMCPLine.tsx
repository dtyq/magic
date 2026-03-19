import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconMCPLine({ size }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" width={size} height={size} fill="none">
			<path
				d="M2.66602 6.71637L7.00651 2.539C7.45169 2.11055 8.63035 1.53113 9.78358 2.64101C10.9368 3.7509 10.3347 4.88527 9.88957 5.31372M9.88957 5.31372L6.88461 8.20574M9.88957 5.31372C10.3347 4.88527 11.5134 4.30584 12.6666 5.41573C13.8199 6.52561 13.2178 7.65998 12.7726 8.08843L8.43214 12.2658L10.2341 14M8.34204 3.98504L5.06741 7.13661C4.73995 7.45176 4.36882 8.35521 5.50403 9.44776C6.63924 10.5403 7.57796 10.1831 7.90543 9.86797L11.1801 6.7164"
				stroke="currentColor"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconMCPLine)
