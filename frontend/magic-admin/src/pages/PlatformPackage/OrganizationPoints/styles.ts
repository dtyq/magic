import { createStyles } from "antd-style"

const useStyles = createStyles(({ token }) => {
	return {
		container: {
			backgroundColor: token.magicColorUsages.bg[0],
			height: "100%",
		},
		desc: {
			fontSize: 12,
			color: token.magicColorUsages.text[3],
		},
		typeTag: {
			width: "fit-content",
		},
	}
})

export default useStyles
