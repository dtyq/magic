import { memo } from "react"
import type { TabIconProps } from "./types"

export const WorkspaceIcon = memo(({ active = false, size = 21 }: TabIconProps) => {
	if (active) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 21 21"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g clipPath="url(#clip0_244_12580)">
					<g clipPath="url(#clip1_244_12580)">
						<path
							d="M2.4165 4.66663C2.4165 3.28591 3.53579 2.16663 4.9165 2.16663H7.4165C8.79722 2.16663 9.9165 3.28591 9.9165 4.66663V9.66663H4.9165C3.53579 9.66663 2.4165 8.54734 2.4165 7.16663V4.66663Z"
							fill="#315CEC"
						/>
						<path
							d="M2.4165 13.8333C2.4165 12.4526 3.53579 11.3333 4.9165 11.3333H9.9165V16.3333C9.9165 17.714 8.79722 18.8333 7.4165 18.8333H4.9165C3.53579 18.8333 2.4165 17.714 2.4165 16.3333V13.8333Z"
							fill="#315CEC"
						/>
						<path
							d="M11.5833 4.66663C11.5833 3.28591 12.7025 2.16663 14.0833 2.16663H16.5833C17.964 2.16663 19.0833 3.28591 19.0833 4.66663V7.16663C19.0833 8.54734 17.964 9.66663 16.5833 9.66663H11.5833V4.66663Z"
							fill="#A2DB59"
						/>
						<path
							d="M11.5833 11.3333H16.5833C17.964 11.3333 19.0833 12.4526 19.0833 13.8333V16.3333C19.0833 17.714 17.964 18.8333 16.5833 18.8333H14.0833C12.7025 18.8333 11.5833 17.714 11.5833 16.3333V11.3333Z"
							fill="#315CEC"
						/>
					</g>
				</g>
				<defs>
					<clipPath id="clip0_244_12580">
						<rect width="20" height="20" fill="white" transform="translate(0.75 0.5)" />
					</clipPath>
					<clipPath id="clip1_244_12580">
						<rect
							width="16.6667"
							height="16.6667"
							fill="white"
							transform="translate(2.4165 2.16663)"
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
			className="active"
		>
			<g clipPath="url(#clip0_244_12650)">
				<g clipPath="url(#clip1_244_12650)">
					<path
						d="M2.4165 4.66669C2.4165 3.28597 3.53579 2.16669 4.9165 2.16669H7.4165C8.79722 2.16669 9.9165 3.28598 9.9165 4.66669V9.66669H4.9165C3.53579 9.66669 2.4165 8.5474 2.4165 7.16669V4.66669Z"
						fill="#1C1D23"
						fillOpacity="0.35"
					/>
					<path
						d="M2.4165 13.8333C2.4165 12.4526 3.53579 11.3333 4.9165 11.3333H9.9165V16.3333C9.9165 17.714 8.79722 18.8333 7.4165 18.8333H4.9165C3.53579 18.8333 2.4165 17.714 2.4165 16.3333V13.8333Z"
						fill="#1C1D23"
						fillOpacity="0.35"
					/>
					<path
						d="M11.5833 4.66663C11.5833 3.28591 12.7025 2.16663 14.0833 2.16663H16.5833C17.964 2.16663 19.0833 3.28591 19.0833 4.66663V7.16663C19.0833 8.54734 17.964 9.66663 16.5833 9.66663H11.5833V4.66663Z"
						fill="#1C1D23"
						fillOpacity="0.35"
					/>
					<path
						d="M11.5833 11.3333H16.5833C17.964 11.3333 19.0833 12.4526 19.0833 13.8333V16.3333C19.0833 17.714 17.964 18.8333 16.5833 18.8333H14.0833C12.7025 18.8333 11.5833 17.714 11.5833 16.3333V11.3333Z"
						fill="#1C1D23"
						fillOpacity="0.35"
					/>
				</g>
			</g>
			<defs>
				<clipPath id="clip0_244_12650">
					<rect width="20" height="20" fill="white" transform="translate(0.75 0.5)" />
				</clipPath>
				<clipPath id="clip1_244_12650">
					<rect
						width="16.6667"
						height="16.6667"
						fill="white"
						transform="translate(2.4165 2.16669)"
					/>
				</clipPath>
			</defs>
		</svg>
	)
})

WorkspaceIcon.displayName = "WorkspaceIcon"
