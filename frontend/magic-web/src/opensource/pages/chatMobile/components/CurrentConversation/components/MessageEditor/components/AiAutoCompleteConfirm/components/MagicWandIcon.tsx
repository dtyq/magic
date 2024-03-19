import { memo } from "react"

/**
 * MagicWandIcon - Magic wand SVG icon with gradient
 *
 * @param props - SVG props
 * @returns JSX.Element
 */
const MagicWandIcon = memo<React.SVGProps<SVGSVGElement>>((props) => {
	const gradientId = "magic-gradient"

	return (
		<svg {...props} viewBox="0 0 14 14" fill="none" preserveAspectRatio="none">
			<defs>
				<linearGradient
					id={gradientId}
					x1="1.75"
					y1="1.75"
					x2="13.103"
					y2="2.77177"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#33D6C0" />
					<stop offset="0.25" stopColor="#5083FB" />
					<stop offset="0.5" stopColor="#336DF4" />
					<stop offset="0.75" stopColor="#4752E6" />
					<stop offset="1" stopColor="#8D55ED" />
				</linearGradient>
			</defs>
			<g>
				<path
					d="M8.75 3.5L10.5 5.25M3.5 12.25L12.25 3.5L10.5 1.75L1.75 10.5L3.5 12.25ZM5.25 1.75C5.25 2.05942 5.37292 2.35617 5.59171 2.57496C5.8105 2.79375 6.10725 2.91667 6.41667 2.91667C6.10725 2.91667 5.8105 3.03958 5.59171 3.25838C5.37292 3.47717 5.25 3.77391 5.25 4.08333C5.25 3.77391 5.12708 3.47717 4.90829 3.25838C4.6895 3.03958 4.39275 2.91667 4.08333 2.91667C4.39275 2.91667 4.6895 2.79375 4.90829 2.57496C5.12708 2.35617 5.25 2.05942 5.25 1.75ZM11.0833 7.58333C11.0833 7.89275 11.2062 8.1895 11.425 8.40829C11.6438 8.62708 11.9406 8.75 12.25 8.75C11.9406 8.75 11.6438 8.87292 11.425 9.09171C11.2062 9.3105 11.0833 9.60725 11.0833 9.91667C11.0833 9.60725 10.9604 9.3105 10.7416 9.09171C10.5228 8.87292 10.2261 8.75 9.91667 8.75C10.2261 8.75 10.5228 8.62708 10.7416 8.40829C10.9604 8.1895 11.0833 7.89275 11.0833 7.58333Z"
					stroke={`url(#${gradientId})`}
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1"
				/>
			</g>
		</svg>
	)
})

MagicWandIcon.displayName = "MagicWandIcon"

export default MagicWandIcon
