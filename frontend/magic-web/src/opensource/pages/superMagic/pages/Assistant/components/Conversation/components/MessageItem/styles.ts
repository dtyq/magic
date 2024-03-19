import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	selfMessageContent: css`
		border-radius: 12px;
		border: 1px solid ${token.magicColorUsages.border};
		background: ${token.magicColorScales.grey[0]};
	`,
	messageHeader: css`
		gap: 10px !important;
		padding: 0;
	`,
	messageWrapper: css`
		gap: 10px !important;
	`,
	messageItem: css`
		gap: 6px;
	`,
}))
