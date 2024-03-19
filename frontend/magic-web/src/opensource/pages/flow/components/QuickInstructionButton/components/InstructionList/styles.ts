import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		dropZone: css`
			width: 100%;
			flex: 1;
			padding: 10px;
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorUsages.white};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		dropZoneBg: css`
			height: 40px;
			border-radius: 8px;
			border: 1px dashed
				${isDarkMode
					? token.magicColorUsages.primaryLight.hover
					: token.magicColorScales.brand[1]};
			background-color: ${isDarkMode
				? token.magicColorUsages.primaryLight.default
				: token.magicColorScales.brand[0]};
		`,
		dragZoneBg: css`
			width: 100%;
			position: absolute;
			top: 0;
			height: 40px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		subTitle: css`
			font-size: 14px;
			font-weight: 600;
			line-height: 20px;
			color: ${isDarkMode ? token.magicColorUsages.text[0] : token.magicColorUsages.text[1]};
			text-overflow: ellipsis;
			-webkit-line-clamp: 1;
			-webkit-box-orient: vertical;
			word-break: break-word;
			overflow-wrap: break-word;
			display: -webkit-box;
			overflow: hidden;
		`,
		actionButton: css`
			border: none;
			padding: 0;
			width: 24px;
			height: 24px;
			border-radius: 6px;
			color: ${token.magicColorUsages.text[2]};
			background-color: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
			color: ${token.magicColorUsages.text[2]};
		`,
		tag: css`
			background-color: transparent;
			border: 1px solid ${token.magicColorUsages.border};
			color: ${token.magicColorUsages.text[3]};
		`,
		desc: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,
		instructionItem: css`
			height: 40px;
			border-radius: 8px;
			padding: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[3]};
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorUsages.white};
			position: relative;
			z-index: 1;
		`,
		icon: css`
			color: ${token.magicColorUsages.text[2]};
		`,
		magicIcon: css`
			width: 24px;
			height: 24px;
			border-radius: 4px;
			padding: 3px;
			background: linear-gradient(
				112deg,
				#33d6c0 0%,
				#5083fb 24.95%,
				#336df4 49.89%,
				#4752e6 74.84%,
				#8d55ed 99.78%
			);
		`,
		pointer: css`
			cursor: pointer;
		`,
	}
})
