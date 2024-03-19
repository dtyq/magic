import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	const textGradient = css`
		background: linear-gradient(
			45deg,
			#33d6c0 0%,
			#5083fb 25%,
			#336df4 50%,
			#4752e6 75%,
			#8d55ed 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	`

	return {
		container: css`
			position: relative;
			width: 100%;
			background: ${token.colorBgContainer};
			border-radius: 8px;
			padding: 0 8px;
		`,

		header: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 2px;
			gap: 10px;
		`,

		titleSection: css`
			display: flex;
			align-items: center;
			gap: 2px;
			flex: 1;
			min-width: 0;
		`,

		titleContainer: css`
			display: flex;
			align-items: center;
			padding: 2px;
			height: 20px;
			gap: 2px;
		`,

		iconWrapper: css`
			width: 14px;
			height: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		`,

		magicIcon: css`
			width: 100%;
			height: 100%;

			path {
				stroke: url(#magic-gradient);
				stroke-width: 1;
				stroke-linecap: round;
				stroke-linejoin: round;
				fill: none;
			}
		`,

		titleText: css`
			${textGradient}
			font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			margin: 0;
			white-space: nowrap;
		`,

		acceptButton: css`
			height: 20px;
			padding: 0 6px;
			border: 1px solid transparent;
			border-radius: 10px;
			background:
				linear-gradient(white, white) padding-box,
				linear-gradient(
						90deg,
						#33d6c0 0%,
						#5083fb 25%,
						#336df4 50%,
						#4752e6 75%,
						#8d55ed 100%
					)
					border-box;
			color: #315cec;
			font-family:
				"PingFang SC",
				-apple-system,
				BlinkMacSystemFont,
				"Segoe UI",
				sans-serif;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			cursor: pointer;
			transition: all 0.2s ease;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			position: relative;

			&:hover {
				background:
					linear-gradient(rgba(51, 214, 192, 0.05), rgba(51, 214, 192, 0.05)) padding-box,
					linear-gradient(
							90deg,
							#33d6c0 0%,
							#5083fb 25%,
							#336df4 50%,
							#4752e6 75%,
							#8d55ed 100%
						)
						border-box;
			}

			&:active {
				background:
					linear-gradient(rgba(51, 214, 192, 0.1), rgba(51, 214, 192, 0.1)) padding-box,
					linear-gradient(
							90deg,
							#33d6c0 0%,
							#5083fb 25%,
							#336df4 50%,
							#4752e6 75%,
							#8d55ed 100%
						)
						border-box;
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		`,

		suggestionText: css`
			font-family:
				"PingFang SC",
				-apple-system,
				BlinkMacSystemFont,
				"Segoe UI",
				sans-serif;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			margin: 0;
			display: flex;
			align-items: center;
		`,

		originalText: css`
			color: #1c1d23;

			&::after {
				content: attr(data-suggested-text);
				color: rgba(28, 29, 35, 0.35);
			}
		`,

		suggestedText: css`
			color: rgba(28, 29, 35, 0.35);
		`,

		// SVG gradient definition
		svgGradient: css`
			position: absolute;
			width: 0;
			height: 0;
			pointer-events: none;
		`,
	}
})

// Utility function for creating gradient ID
export const getGradientId = () => "magic-gradient-" + Math.random().toString(36).substr(2, 9)
