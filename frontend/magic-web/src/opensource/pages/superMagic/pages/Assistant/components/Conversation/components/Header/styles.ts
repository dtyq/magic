import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		height: 100%;
		padding: 0 12px;
		background: rgba(255, 255, 255, 0.4);
		backdrop-filter: blur(50px);
	`,
	topicName: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	actions: css`
		display: flex;
		align-items: center;
	`,
	actionButton: css`
		border: none;
		color: ${token.magicColorUsages.text[1]};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		gap: 4px;
	`,
}))
