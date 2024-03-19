import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			width: 100%;
			height: 100%;
		`,

		empty: css`
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 400px;
			color: ${token.magicColorUsages.text[3]};
			font-size: 14px;
		`,

		loading: css`
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 400px;
		`,
	}
})
