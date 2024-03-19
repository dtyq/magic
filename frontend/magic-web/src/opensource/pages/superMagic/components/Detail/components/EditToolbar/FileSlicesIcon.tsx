import { memo } from "react"

function FileSlicesIcon({ size = 16 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g clipPath="url(#clip0_7768_20793)">
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M10.509 0L15.3337 4.82467V14.6667C15.3337 15.0203 15.1932 15.3594 14.9431 15.6095C14.6931 15.8595 14.3539 16 14.0003 16H2.00033C1.6467 16 1.30757 15.8595 1.05752 15.6095C0.807468 15.3594 0.666992 15.0203 0.666992 14.6667V1.33333C0.666992 0.979711 0.807468 0.640573 1.05752 0.390524C1.30757 0.140476 1.6467 0 2.00033 0L10.509 0Z"
					fill="#FA5C26"
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M11.8421 4.82467C11.4885 4.82467 11.1494 4.68419 10.8993 4.43414C10.6493 4.18409 10.5088 3.84496 10.5088 3.49133V0L15.3335 4.82467H11.8421Z"
					fill="white"
					fillOpacity="0.401"
				/>
				<path
					d="M8.39731 11.9841V13.1746H10.3814V13.9682H5.61953V13.1746H7.60366V11.9841H4.82588C4.58778 11.9841 4.42905 11.8254 4.42905 11.5873V6.82539H4.03223V6.03174H11.9687V6.82539H11.5719V11.5873C11.5719 11.8254 11.4132 11.9841 11.1751 11.9841H8.39731ZM7.20683 7.61904V10.3968L9.19096 9.00793L7.20683 7.61904Z"
					fill="white"
				/>
			</g>
			<defs>
				<clipPath id="clip0_7768_20793">
					<rect width="16" height="16" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default memo(FileSlicesIcon)
