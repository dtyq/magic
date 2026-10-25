import type { ReactElement } from "react"

export default function PhoneStatusIcons(): ReactElement {
	return (
		<>
			{/* Cellular */}
			<svg
				width="18"
				height="12"
				viewBox="0 0 18 12"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="opacity-90"
			>
				<rect x="1" y="8" width="3" height="4" rx="1" fill="currentColor" />
				<rect x="5" y="6" width="3" height="6" rx="1" fill="currentColor" />
				<rect x="9" y="3" width="3" height="9" rx="1" fill="currentColor" />
				<rect x="13" y="0" width="3" height="12" rx="1" fill="currentColor" />
			</svg>
			{/* Wi-Fi */}
			<svg
				width="16"
				height="12"
				viewBox="0 0 16 12"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				data-testid="self-media-phone-shell-wifi-icon"
				className="opacity-90"
			>
				<path
					d="M8 11.25C8.69036 11.25 9.25 10.6904 9.25 10C9.25 9.30964 8.69036 8.75 8 8.75C7.30964 8.75 6.75 9.30964 6.75 10C6.75 10.6904 7.30964 11.25 8 11.25Z"
					fill="currentColor"
				/>
				<path
					d="M11.0913 7.80176C9.3838 6.09428 6.6162 6.09428 4.90873 7.80176L3.84766 6.74069C6.1412 4.44715 9.8588 4.44715 12.1523 6.74069L11.0913 7.80176Z"
					fill="currentColor"
				/>
				<path
					d="M13.9203 4.97227C10.6508 1.70281 5.34924 1.70281 2.07978 4.97227L1.01872 3.9112C4.87426 0.0556602 11.1257 0.0556602 14.9813 3.9112L13.9203 4.97227Z"
					fill="currentColor"
				/>
			</svg>
			{/* Battery */}
			<svg
				width="25"
				height="12"
				viewBox="0 0 25 12"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="opacity-90"
			>
				<rect
					x="0.5"
					y="0.5"
					width="21"
					height="11"
					rx="3.5"
					stroke="currentColor"
					strokeOpacity="0.35"
				/>
				<rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" />
				<path
					d="M24 4C24.5523 4 25 4.44772 25 5V7C25 7.55228 24.5523 8 24 8V4Z"
					fill="currentColor"
					fillOpacity="0.4"
				/>
			</svg>
		</>
	)
}
