import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		aiGeneratedTip: {
			fontSize: "12px",
			color: `${token.magicColorUsages.text[3]}`,
			lineHeight: "16px",
			margin: "20px auto",
			textAlign: "center",
			marginBottom: "10px",
		},
	}
})
