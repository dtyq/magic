import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => ({
	chatItem: css`
		background-color: transparent;
		padding: 0 10px;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 60px;
		border-radius: 8px;
		position: relative;
		cursor: pointer;
		transition: background-color 0.2s ease;
		&:active {
			background-color: ${token.magicColorScales.grey[0]};
		}

		* {
			user-select: none;
			-webkit-user-select: none;
		}
	`,
	chatItemContent: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2;
		flex: 1;
		min-width: 0; // Prevent text overflow issues
	`,
	chatItemHeader: css`
		display: flex;
		align-items: center;
		gap: 2px;
		width: 100%;
	`,
	chatItemName: css`
		overflow: hidden;
		color: ${token.magicColorUsages?.text[1]};
		text-overflow: ellipsis;
		font-size: ${token.magicFontUsages.response.text14px};
		font-style: normal;
		font-weight: 400;
		line-height: 20px;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	chatItemTime: css`
		overflow: hidden;
		color: ${token.magicColorUsages?.text[2]};
		text-align: right;
		text-overflow: ellipsis;
		font-size: ${token.magicFontUsages.response.text12px};
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		flex-shrink: 0;
	`,
	chatItemMessage: css`
		color: ${token.magicColorUsages?.text[3]};
		text-overflow: ellipsis;
		font-size: ${token.magicFontUsages.response.text12px};
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		flex: 1;
		min-width: 0;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 1;
		align-self: stretch;
		overflow: hidden;
	`,
	chatItemBadge: css`
		.${prefixCls}-badge-count {
			--${prefixCls}-badge-indicator-height: 16px;
		}
	`,
	swipeAction: css`
		--adm-color-background: transparent;
		--adm-color-warning: ${token.magicColorUsages?.warning.default};
		--adm-color-danger: ${token.magicColorUsages?.danger.default};
		--adm-color-primary: ${token.magicColorUsages?.primary.default};

		.adm-swipe-action-action-button {
			width: 70px;
		}
	`,
	swipeActionText: css`
		color: ${token.magicColorUsages?.white};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	`,
}))
