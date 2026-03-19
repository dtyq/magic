import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, isDarkMode, prefixCls }) => ({
	taskList: css`
		max-height: 500px;
	`,
	listItem: css`
		padding: 0;
		border: none;
	`,
	title: css`
		font-size: 16px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
	`,
	wrapper: css`
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		::-webkit-scrollbar {
			display: none;
		}
	`,
	content: css`
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		.${prefixCls}-row {
			gap: 4px;
		}
	`,
	button: css`
		height: 42px;
		border: 1px solid ${token.magicColorUsages.border};
		color: ${token.magicColorUsages.text[1]};
		flex-shrink: 0;
	`,
	icon: css`
		color: ${token.magicColorUsages.text[1]};
	`,
	ellipsis: css`
		text-overflow: ellipsis;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		display: -webkit-box;
		overflow: hidden;
	`,
	subTitle: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[0]};
	`,
	desc: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[2]};
	`,
	taskItem: css`
		padding: 8px 0 8px 8px;
		cursor: pointer;
		border-radius: 8px;
		&:hover {
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorScales.grey[0]};
		}
	`,
	dots: css`
		align-self: center;
	`,
}))
