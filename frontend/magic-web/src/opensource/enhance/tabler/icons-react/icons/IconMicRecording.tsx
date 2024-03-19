import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconMicRecording = ({ size = 20, stroke = 1.5, color }: IconProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
		>
			<path
				d="M7.5 4.16699C7.5 3.50395 7.76339 2.86807 8.23223 2.39923C8.70107 1.93038 9.33696 1.66699 10 1.66699C10.663 1.66699 11.2989 1.93038 11.7678 2.39923C12.2366 2.86807 12.5 3.50395 12.5 4.16699V8.33366C12.5 8.9967 12.2366 9.63258 11.7678 10.1014C11.2989 10.5703 10.663 10.8337 10 10.8337C9.33696 10.8337 8.70107 10.5703 8.23223 10.1014C7.76339 9.63258 7.5 8.9967 7.5 8.33366V4.16699Z"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M4.16602 8.33301C4.16602 9.8801 4.7806 11.3638 5.87456 12.4578C6.96852 13.5518 8.45225 14.1663 9.99935 14.1663"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M6.66602 17.5H9.99935"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M10 14.167V17.5003"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M13.334 15.833C13.334 16.496 13.5974 17.1319 14.0662 17.6008C14.5351 18.0696 15.1709 18.333 15.834 18.333C16.497 18.333 17.1329 18.0696 17.6018 17.6008C18.0706 17.1319 18.334 16.496 18.334 15.833C18.334 15.17 18.0706 14.5341 17.6018 14.0652C17.1329 13.5964 16.497 13.333 15.834 13.333C15.1709 13.333 14.5351 13.5964 14.0662 14.0652C13.5974 14.5341 13.334 15.17 13.334 15.833Z"
				fill="#FF4D3A"
				stroke="#FF4D3A"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconMicRecording)
