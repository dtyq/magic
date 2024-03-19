import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		form: css`
			display: flex;
			flex-direction: column;
			gap: 20px;
		`,
		required: css`
			color: ${token.magicColorUsages.danger.default};
		`,
	}
})
