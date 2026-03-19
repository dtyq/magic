import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			display: flex;
			align-items: center;
			width: fit-content;
			gap: 4px;
			border-radius: 8px;
			height: 20px;
			width: 100%;
		`,
		canManage: css`
			cursor: pointer;
		`,

		selfCollaboration: css`
			border: 1px solid ${token.magicColorUsages.border};
			padding: 4px 8px;
			height: 28px;
			width: fit-content;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
	}
})
