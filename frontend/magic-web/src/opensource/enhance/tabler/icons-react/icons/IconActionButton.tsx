import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconActionButton({ size = 24 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M12 7.00065C12 7.44268 12.1756 7.8666 12.4882 8.17916C12.8007 8.49172 13.2246 8.66732 13.6667 8.66732C14.1087 8.66732 14.5326 8.49172 14.8452 8.17916C15.1577 7.8666 15.3333 7.44268 15.3333 7.00065C15.3333 6.55862 15.1577 6.1347 14.8452 5.82214C14.5326 5.50958 14.1087 5.33398 13.6667 5.33398C13.2246 5.33398 12.8007 5.50958 12.4882 5.82214C12.1756 6.1347 12 6.55862 12 7.00065Z"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M5.33301 7H11.9997"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M15.333 7H18.6663"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M7 12.0007C7 12.4427 7.17559 12.8666 7.48816 13.1792C7.80072 13.4917 8.22464 13.6673 8.66667 13.6673C9.10869 13.6673 9.53262 13.4917 9.84518 13.1792C10.1577 12.8666 10.3333 12.4427 10.3333 12.0007C10.3333 11.5586 10.1577 11.1347 9.84518 10.8221C9.53262 10.5096 9.10869 10.334 8.66667 10.334C8.22464 10.334 7.80072 10.5096 7.48816 10.8221C7.17559 11.1347 7 11.5586 7 12.0007Z"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M5.33301 12H6.99967"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M10.333 12H18.6663"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M14.5 17.0007C14.5 17.4427 14.6756 17.8666 14.9882 18.1792C15.3007 18.4917 15.7246 18.6673 16.1667 18.6673C16.6087 18.6673 17.0326 18.4917 17.3452 18.1792C17.6577 17.8666 17.8333 17.4427 17.8333 17.0007C17.8333 16.5586 17.6577 16.1347 17.3452 15.8221C17.0326 15.5096 16.6087 15.334 16.1667 15.334C15.7246 15.334 15.3007 15.5096 14.9882 15.8221C14.6756 16.1347 14.5 16.5586 14.5 17.0007Z"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M5.33301 17H14.4997"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M17.833 17H18.6663"
				stroke="#1C1D23"
				strokeOpacity="0.8"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconActionButton)
