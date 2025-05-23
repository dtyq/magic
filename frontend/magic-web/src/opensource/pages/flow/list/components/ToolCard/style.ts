import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		drawerItem: css`
			width: 100%;
			min-height: 68px;
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[2]
				: token.magicColorUsages.fill[0]};
			color: ${isDarkMode ? token.magicColorUsages.text[3] : token.magicColorUsages.text[2]};
			border-radius: 12px;
			padding: 12px;
			font-size: 12px;
			font-weight: 400;
			position: relative;
		`,
		drawerItemActive: css`
			cursor: pointer;
		`,
		drawerItemTitle: css`
			font-size: 14px;
			font-weight: 600;
			overflow: hidden;
			color: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorUsages.text[1]};
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 1;
			word-break: break-all;
		`,
		require: css`
			color: ${isDarkMode
				? token.magicColorScales.orange[1]
				: token.magicColorScales.orange[5]};
		`,
		moreOperations: css`
			cursor: pointer;
			position: absolute;
			right: 12px;
			top: 10px;
		`,
		subDesc: {
			lineHeight: "16px",
			overflow: "hidden",
			textOverflow: "ellipsis",
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			WebkitLineClamp: 1,
			wordBreak: "break-all",
		},
	}
})

export default useStyles
