import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	popupBody: css`
		min-height: 60vh;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	`,
	header: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid ${token.colorBorder};
		background-color: ${token.magicColorUsages?.bg?.[0]};
		flex-shrink: 0;
	`,
	title: css`
		color: ${token.magicColorUsages?.text?.[0]};
		font-size: 16px;
		font-weight: 600;
		line-height: 24px;
	`,
	closeButton: css`
		width: 32px;
		height: 32px;
		border-radius: 4px;
		border: none;
		background-color: transparent;
		display: flex;
		justify-content: center;
		align-items: center;
		color: ${token.magicColorUsages?.text?.[1]};
		cursor: pointer;
		transition: background-color 0.2s ease;
		&:active {
			background-color: ${token.magicColorUsages?.bg?.[1]};
		}
	`,
	content: css`
		flex: 1;
		overflow-y: auto;
		padding: 10px 8px;
		background-color: ${token.magicColorUsages?.bg?.[0]};
	`,
}))
