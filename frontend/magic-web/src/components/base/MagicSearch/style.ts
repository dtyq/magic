import { createStyles } from "antd-style"

export const useSearchStyles = createStyles(({ isDarkMode, token }) => {
	return {
		search: {
			paddingLeft: 6,
			paddingRight: 6,
			borderRadius: 8,
			border: `1px solid transparent`,
			color: isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3],
			// background: isDarkMode ? token.magicColorScales.grey[7] : token.magicColorUsages.white,
			backgroundColor: token.magicColorScales.grey[1],
			transition: "0.1s linear width",

			[`&:hover`]: {
				border: `1px solid ${token.colorBorder}`,
				backgroundColor: `${token.magicColorUsages.fill[0]}`,
				color: `${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2]}`,
			},
			[`&:active`]: {
				backgroundColor: `${token.magicColorUsages.fill[2]}`,
			},
		},
	}
})
