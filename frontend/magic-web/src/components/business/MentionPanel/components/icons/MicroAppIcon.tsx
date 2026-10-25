import { memo, useId } from "react"

function MicroAppIcon({ size = 16 }: { size?: number }) {
	const gradientId = useId()
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			className="shrink-0"
			aria-hidden="true"
		>
			<path
				d="M16 8C16 14.2501 14.2501 16 8 16C1.74988 16 0 14.2501 0 8C0 1.74988 1.74988 0 8 0C14.2501 0 16 1.74988 16 8Z"
				fill={`url(#${gradientId})`}
			/>
			<g fill="white">
				<rect x="3.5" y="3.5" width="4" height="4" rx="1" />
				<rect x="8.5" y="3.5" width="4" height="4" rx="1" />
				<rect x="3.5" y="8.5" width="4" height="4" rx="1" />
				<rect x="8.5" y="8.5" width="4" height="4" rx="1" />
			</g>
			<defs>
				<linearGradient
					id={gradientId}
					x1="0"
					y1="0"
					x2="16"
					y2="16"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#72C5FF" />
					<stop offset="1" stopColor="#2563EB" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default memo(MicroAppIcon)
