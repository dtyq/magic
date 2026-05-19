import type { LucideProps } from "lucide-react"
import { useId } from "react"

export default function CanvasFileIcon({ size = 24, className, ...props }: LucideProps) {
	const gradientId = `canvas-file-icon-gradient-${useId().replace(/:/g, "")}`

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={className}
			aria-hidden
			{...props}
		>
			<path
				d="M0 4C0 1.79086 1.79086 0 4 0H20C22.2091 0 24 1.79086 24 4V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4Z"
				fill={`url(#${gradientId})`}
			/>
			<path
				d="M7 4C7.55228 4 8 4.44772 8 5V6H12V8H8V16H16V12H18V16H19C19.5523 16 20 16.4477 20 17C20 17.5523 19.5523 18 19 18H18V19C18 19.5523 17.5523 20 17 20C16.4477 20 16 19.5523 16 19V18H8V19C8 19.5523 7.55228 20 7 20C6.44772 20 6 19.5523 6 19V18H5C4.44772 18 4 17.5523 4 17C4 16.4477 4.44772 16 5 16H6V8H5C4.44772 8 4 7.55228 4 7C4 6.44772 4.44772 6 5 6H6V5C6 4.44772 6.44772 4 7 4Z"
				fill="white"
			/>
			<path
				d="M17.9643 10.8627C18.264 11.1617 18.7664 10.8717 18.6573 10.4626L18.0264 8.09676C17.9884 7.95407 18.0292 7.80192 18.1334 7.69737L19.8627 5.96391C20.1617 5.66417 19.8717 5.16183 19.4626 5.27092L17.0968 5.90177C16.9541 5.93982 16.8019 5.89905 16.6974 5.79476L14.9639 4.06549C14.6642 3.76647 14.1618 4.0565 14.2709 4.46559L14.9018 6.83144C14.9398 6.97413 14.8991 7.12629 14.7948 7.23083L13.0655 8.96429C12.7665 9.26404 13.0565 9.76637 13.4656 9.65729L15.8314 9.02643C15.9741 8.98838 16.1263 9.02915 16.2308 9.13345L17.9643 10.8627Z"
				fill="white"
			/>
			<defs>
				<linearGradient
					id={gradientId}
					x1="27.25"
					y1="25.75"
					x2="2"
					y2="0.00000160716"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#6F6F6F" />
					<stop offset="1" stopColor="#1C1D23" />
				</linearGradient>
			</defs>
		</svg>
	)
}
