import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		container: {
			borderLeft: `2px solid ${token.magicColorUsages.border}`,
			paddingLeft: 10,
			opacity: 0.5,
			cursor: "pointer",
			userSelect: "none",
			height: "fit-content",
			overflow: "hidden",
		},
		title: css`
			font-size: 10px;
			line-height: 12px;
			color: ${token.magicColorUsages.primary.default};
		`,
		content: css`
			max-height: 30px;
			overflow-y: auto;
			overflow-x: hidden;
		`,
	}
})
