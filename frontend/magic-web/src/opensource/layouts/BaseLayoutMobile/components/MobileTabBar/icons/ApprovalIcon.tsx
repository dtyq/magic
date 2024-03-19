import { memo } from "react"
import type { TabIconProps } from "./types"

export const ApprovalIcon = memo(({ active = false, size = 21 }: TabIconProps) => {
	if (active) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 21 21"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="active"
			>
				<g clipPath="url(#clip0_244_12503)">
					<g clipPath="url(#clip1_244_12503)">
						<path
							d="M18.5834 14.6667H1.91675C1.91675 11.2576 3.23249 11.2576 5.42601 11.2576C10.2501 11.2576 6.54638 7.39396 6.54638 5.53369C6.54638 4.64071 6.93659 3.78429 7.63117 3.15286C8.32575 2.52142 9.2678 2.16669 10.2501 2.16669C11.2324 2.16669 12.1744 2.52142 12.869 3.15286C13.5636 3.78429 13.9538 4.64071 13.9538 5.53369C13.9538 7.39396 10.2501 11.2576 15.0742 11.2576C17.2677 11.2576 18.5834 11.2576 18.5834 14.6667Z"
							fill="#315CEC"
						/>
						<path
							d="M1.91675 17.1667C1.91675 16.2463 2.66294 15.5001 3.58342 15.5001H16.9167C17.8372 15.5001 18.5834 16.2463 18.5834 17.1667C18.5834 18.0872 17.8372 18.8334 16.9167 18.8334H3.58341C2.66294 18.8334 1.91675 18.0872 1.91675 17.1667Z"
							fill="#FF6BA2"
						/>
					</g>
				</g>
				<defs>
					<clipPath id="clip0_244_12503">
						<rect width="20" height="20" fill="white" transform="translate(0.25 0.5)" />
					</clipPath>
					<clipPath id="clip1_244_12503">
						<rect
							width="16.6667"
							height="16.6667"
							fill="white"
							transform="translate(1.91675 2.16669)"
						/>
					</clipPath>
				</defs>
			</svg>
		)
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 21 21"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g clipPath="url(#clip0_244_12433)">
				<g clipPath="url(#clip1_244_12433)">
					<path
						d="M18.5834 14.6667H1.91675C1.91675 11.2576 3.23249 11.2576 5.42601 11.2576C10.2501 11.2576 6.54638 7.39396 6.54638 5.53369C6.54638 4.64071 6.93659 3.78429 7.63117 3.15286C8.32575 2.52142 9.2678 2.16669 10.2501 2.16669C11.2324 2.16669 12.1744 2.52142 12.869 3.15286C13.5636 3.78429 13.9538 4.64071 13.9538 5.53369C13.9538 7.39396 10.2501 11.2576 15.0742 11.2576C17.2677 11.2576 18.5834 11.2576 18.5834 14.6667Z"
						fill="#1C1D23"
						fillOpacity="0.35"
					/>
					<path
						d="M1.91675 17.5833C1.91675 16.893 2.47639 16.3333 3.16675 16.3333H17.3334C18.0238 16.3333 18.5834 16.893 18.5834 17.5833C18.5834 18.2737 18.0238 18.8333 17.3334 18.8333H3.16675C2.47639 18.8333 1.91675 18.2737 1.91675 17.5833Z"
						fill="#1C1D23"
						fillOpacity="0.35"
					/>
				</g>
			</g>
			<defs>
				<clipPath id="clip0_244_12433">
					<rect width="20" height="20" fill="white" transform="translate(0.25 0.5)" />
				</clipPath>
				<clipPath id="clip1_244_12433">
					<rect
						width="16.6667"
						height="16.6667"
						fill="white"
						transform="translate(1.91675 2.16669)"
					/>
				</clipPath>
			</defs>
		</svg>
	)
})

ApprovalIcon.displayName = "ApprovalIcon"
