import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconMode = memo(({ size = 24 }: IconProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
		>
			<path
				d="M21 12C21 14.3869 20.0518 16.6761 18.364 18.364C16.6761 20.0518 14.3869 21 12 21C9.61305 21 7.32387 20.0518 5.63604 18.364C3.94821 16.6761 3 14.3869 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M16 13C16.2933 11.7875 16.9152 10.6793 17.7973 9.79726C18.6793 8.91517 19.7875 8.29331 21 8C19.7875 7.70669 18.6793 7.08483 17.7973 6.20274C16.9152 5.32066 16.2933 4.21249 16 3C15.7067 4.21249 15.0848 5.32066 14.2027 6.20274C13.3207 7.08483 12.2125 7.70669 11 8C12.2125 8.29331 13.3207 8.91517 14.2027 9.79726C15.0848 10.6793 15.7067 11.7875 16 13Z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

export default IconMode
