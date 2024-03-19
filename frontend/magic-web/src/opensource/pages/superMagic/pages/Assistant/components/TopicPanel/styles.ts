import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		width: 240px;
		height: 100%;
	`,
	header: css`
		padding: 8px;
		height: 70px;
	`,
	headerTitle: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
	`,
	search: css`
		background-color: ${token.magicColorUsages.white};
		border: 1px solid ${token.colorBorder};
		user-select: none;
	`,
	list: css`
		padding: 8px;
		flex: 1;
		height: 100%;
		max-height: calc(100% - 70px);
	`,
	topicList: css`
		::-webkit-scrollbar {
			display: none;
		}

		[data-testid="virtuoso-item-list"] div:not(:first-child) {
			margin-top: 4px;
		}
	`,
}))
