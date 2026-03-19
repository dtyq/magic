import { createStyles, cx } from "antd-style"

export const useStyles = createStyles(({ css, token, isDarkMode }) => {
	const buttonGroup = cx(css`
		position: absolute;
		bottom: 20px;
	`)

	return {
		container: css`
			width: 100%;
			height: 100%;
			position: relative;
			overflow: hidden;
			background: ${isDarkMode ? token.magicColorUsages.bg[0] : token.magicColorUsages.white};
			border-radius: 6px;
			max-width: 100% !important;
			max-height: 100% !important;

			.${buttonGroup} {
				opacity: 0;
				transition: opacity 0.2s ease;
			}

			&:hover {
				.${buttonGroup} {
					opacity: 1;
				}
			}
		`,
		image: css`
			width: 100%;
			height: 100%;
			max-width: unset;
			max-height: unset;
			object-fit: cover !important;
			object-position: center;
		`,
		text: css`
			color: ${token.magicColorScales.black};
			text-align: center;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			user-select: none;
		`,
		animationBg: css`
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		`,
		buttonGroup,
		button: css`
			height: 32px;
			font-size: 12px;
			margin: 0 auto;
			border-radius: 8px;
			padding: 4px 8px;
			color: ${isDarkMode ? token.magicColorUsages.text[1] : token.magicColorUsages.text[1]};
			background: ${isDarkMode
				? token.magicColorUsages.bg[1]
				: token.magicColorUsages.white} !important;
			transition: all 0.5s ease;
		`,
		mobileActionButton: css`
			position: absolute;
			top: 10px;
			right: 10px;
			width: 32px;
			height: 32px;
			border-radius: 50%;
			background: ${isDarkMode
				? `${token.magicColorUsages.bg[1]}cc`
				: `${token.magicColorUsages.white}cc`} !important;
			border: none;
			color: ${token.magicColorUsages.text[1]};
			backdrop-filter: blur(4px);
			transition: all 0.2s ease;

			&:hover {
				background: ${isDarkMode
					? token.magicColorUsages.bg[2]
					: token.magicColorUsages.fill[0]} !important;
			}

			&:active {
				transform: scale(0.95);
			}
		`,
	}
})
