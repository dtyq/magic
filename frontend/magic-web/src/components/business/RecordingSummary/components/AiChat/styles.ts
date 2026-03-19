import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, responsive }) => ({
	messageList: css`
		padding-top: 10px;

		${responsive.mobile} {
			padding-top: 0;
		}

		.message-list-container {
			padding: 0;
		}
	`,
	messageListFallback: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	`,
	aiGeneratedMessageTip: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 10px;
		line-height: 13px;
		text-align: center;
		margin-top: 10px;
	`,
}))
