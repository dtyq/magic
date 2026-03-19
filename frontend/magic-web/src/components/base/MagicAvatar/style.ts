import { createStyles } from "antd-style"
import { textToBackgroundColor, textToTextColor } from "./utils"

export const useStyles = createStyles(
	({ css, token }, { url, content }: { url: string; content: string }) => {
		return {
			avatar: css`
				user-select: none;
				border: 1px solid ${token.magicColorUsages.border};
				font-weight: 500;
				text-shadow: 0px 1px 1px #00000030;
				${!url
					? `
        background: ${textToBackgroundColor(content)};
        color: ${textToTextColor(content)};
      `
					: ""}
			`,
		}
	},
)
