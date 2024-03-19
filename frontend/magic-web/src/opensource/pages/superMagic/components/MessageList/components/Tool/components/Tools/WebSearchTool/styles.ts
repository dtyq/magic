import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	searchContent: css`
		background: ${token.colorBgContainer};
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};
	`,

	searchResults: css`
		font-size: 14px;
		color: ${token.colorText};
		line-height: 1.6;
	`,

	suffixContainer: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 1;
		min-width: 0;
		flex: 1;
		pointer-events: none;
	`,

	suffix: css`
		padding: 2px 10px;
		height: 20px;
		white-space: nowrap;
		font-size: 12px;
		line-height: 16px;
		flex-shrink: 1;
		border-radius: 1000px;
		overflow: hidden;
		text-overflow: ellipsis;
		width: auto;
	`,
	suffixSelected: css`
		background: #eef3fd;
		color: ${token.colorPrimary};
	`,
	suffixDefault: css`
		background: rgba(46, 47, 56, 0.05);
		color: ${token.colorText};
	`,
	suffixMore: css`
		min-width: 40px;
		width: 35px;
		flex-shrink: 0;
		background: rgba(46, 47, 56, 0.05);
		color: ${token.colorText};
	`,
}))
