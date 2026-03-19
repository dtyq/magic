import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	buttonBack: css`
		width: 24px;
		height: 24px;
		padding: 0;
		color: ${token.magicColorUsages.text[1]};
	`,
	title: css`
		font-size: 16px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
	`,
	formItem: css`
		margin-bottom: 4px;
	`,
	radioGroup: css`
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 10px;
	`,
	custom: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[2]};
	`,
}))
