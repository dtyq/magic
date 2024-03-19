import React from "react"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => ({
	loadingIcon: css`
		display: inline-block;
		animation: spin 1s linear infinite;

		@keyframes spin {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}
	`,
	pausedIcon: css`
		display: inline-block;
		/* 暂停状态下不旋转 */
	`,
}))

interface MagicLoadingIconProps {
	size?: number
	paused?: boolean
}

export const MagicLoadingIcon: React.FC<MagicLoadingIconProps> = ({
	size = 20,
	paused = false,
}) => {
	const { styles } = useStyles()

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			className={paused ? styles.pausedIcon : styles.loadingIcon}
		>
			<mask id="path-1-inside-1_3886_139816" fill="white">
				<path d="M20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10Z" />
			</mask>
			<g
				clipPath="url(#paint0_angular_3886_139816_clip_path)"
				data-figma-skip-parse="true"
				mask="url(#path-1-inside-1_3886_139816)"
			>
				<g transform="matrix(0 0.01 -0.01 0 10 10)">
					<foreignObject x="-1400" y="-1400" width="2800" height="2800">
						<div
							style={{
								background:
									"conic-gradient(from 90deg,rgba(255, 255, 255, 0) 0deg,rgba(49, 92, 236, 1) 360deg)",
								height: "100%",
								width: "100%",
								opacity: 1,
							}}
						/>
					</foreignObject>
				</g>
			</g>
			<path
				d="M20 10H16C16 13.3137 13.3137 16 10 16V20V24C17.732 24 24 17.732 24 10H20ZM10 20V16C6.68629 16 4 13.3137 4 10H0H-4C-4 17.732 2.26801 24 10 24V20ZM0 10H4C4 6.68629 6.68629 4 10 4V0V-4C2.26801 -4 -4 2.26801 -4 10H0ZM10 0V4C13.3137 4 16 6.68629 16 10H20H24C24 2.26801 17.732 -4 10 -4V0Z"
				mask="url(#path-1-inside-1_3886_139816)"
				fill="url(#gradient)"
			/>
			<defs>
				<clipPath id="paint0_angular_3886_139816_clip_path">
					<path
						d="M20 10H16C16 13.3137 13.3137 16 10 16V20V24C17.732 24 24 17.732 24 10H20ZM10 20V16C6.68629 16 4 13.3137 4 10H0H-4C-4 17.732 2.26801 24 10 24V20ZM0 10H4C4 6.68629 6.68629 4 10 4V0V-4C2.26801 -4 -4 2.26801 -4 10H0ZM10 0V4C13.3137 4 16 6.68629 16 10H20H24C24 2.26801 17.732 -4 10 -4V0Z"
						mask="url(#path-1-inside-1_3886_139816)"
					/>
				</clipPath>
				<linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
					<stop offset="100%" stopColor="rgba(49, 92, 236, 1)" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default MagicLoadingIcon
