import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
	container: css`
		width: 100%;
		/* border-left: 1px solid ${token.colorBorder}; */
		height: 100%;
		user-select: none;
		box-shadow: none;
	`,
	icon: css`
		background-color: ${token.magicColorScales.brand[5]};
		color: white;
		border-radius: 4px;
		padding: 4px;
		user-select: none;
	`,
	search: css`
		background-color: ${token.magicColorUsages.white};
		border: 1px solid ${token.colorBorder};
		user-select: none;
	`,
	body: css`
		--${prefixCls}-padding-lg: 12px;
		--${prefixCls}-card-body-padding: 12px;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow: hidden;
		user-select: none;
	`,
	header: css`
		height: 60px;
		--${prefixCls}-padding-lg: 12px;
		user-select: none;
	`,
	tip: css`
		padding: 0 10px 20px 10px;
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};
		background: ${token.magicColorScales.grey[0]};
		user-select: none;
	`,
	tipPicture: css`
		width: 100%;
	`,
	tipTitle: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
		margin-bottom: 4px;
	`,

	tipDescription: css`
		color: ${token.magicColorUsages.text[2]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	topicItem: css`
		width: 100%;
	`,
	topicItemJoinButton: css`
		padding: 0;
		height: 24px;
	`,
	topicList: css`
		::-webkit-scrollbar {
			display: none;
		}

		[data-testid="virtuoso-item-list"] div:not(:first-child) {
			margin-top: 4px;
		}
	`,
	divider: css`
		height: 1px;
		background: ${token.colorBorder};
	`,
}))
