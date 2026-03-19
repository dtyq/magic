import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, token }, { open }: { open: boolean }) => {
	return {
		container: css`
			width: ${open ? "320px" : 0};
			padding: ${open ? "12px" : 0};
			background-color: ${isDarkMode
				? token.magicColorScales.grey[9]
				: token.magicColorUsages.white};
			border-left: 1px solid
				${isDarkMode ? token.magicColorScales.grey[8] : token.colorBorder};
			background-color: ${isDarkMode
				? token.magicColorScales.grey[9]
				: token.magicColorScales.grey[0]};
			position: relative;
			overflow: hidden;
			transition: width 0.2s;
			flex-shrink: 0;
			.magic-spin-dot {
				width: 10px;
				height: 10px;
				svg {
					width: 10px;
					height: 10px;
				}
			}
		`,
		close: css`
			cursor: pointer;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
		`,
		top: css`
			width: 100%;
			min-height: 76px;
		`,
		title: {
			overflow: "hidden",
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1],
			textOverflow: "ellipsis",
			fontSize: 16,
			fontWeight: 600,
			lineHeight: "22px",
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			WebkitLineClamp: 1,
			wordBreak: "break-all",
		},
		desc: {
			width: "100%",
			flex: 1,
			overflow: "hidden",
			color: isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2],
			textOverflow: "ellipsis",
			fontSize: 12,
			fontWeight: 400,
			lineHeight: "16px",
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			WebkitLineClamp: 2,
		},
		button: css`
			flex: 1;
			border: 1px solid ${token.colorBorder};
			background-color: ${isDarkMode
				? token.magicColorScales.grey[9]
				: token.magicColorUsages.white};
		`,
		subTitle: css`
			padding-top: 10px;
			font-size: 14px;
			font-weight: 600;
			color: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorUsages.text[1]};
		`,
		emptyTips: css`
			font-size: 14px;
			font-weight: 400;
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2]};
		`,
		drawerContainer: css`
			width: 100%;
			height: calc(100vh - 320px);
			overflow-y: auto;
			padding: 10px 0;
		`,
	}
})

export default useStyles
