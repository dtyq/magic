import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	headerInnerContainer: css`
		width: 100%;
		display: flex;
		height: 60px;
		padding: 0px 50px 0px 20px;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
		align-self: stretch;
		background-color: ${token.magicColorUsages.fill[0]};
		user-select: none;
		flex: none;
	`,
	title: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 14px;
		line-height: 20px;
		font-weight: 400;
	`,
	subtitle: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
	`,
	headerButton: css`
		color: ${token.colorTextSecondary};
		font-size: 10px;
		font-weight: 400;
		line-height: 12px;
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};
		background-color: ${token.magicColorUsages.fill[0]};
		padding: 4px 8px;
		height: 40px;
		width: 70px;
	`,
}))
