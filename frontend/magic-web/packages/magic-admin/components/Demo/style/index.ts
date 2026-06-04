import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	card: css`
		width: 100%;
		height: 100px;
		background-color: ${token.colorBgContainer};
		border-radius: ${token.borderRadiusLG}px;
		border: 1px solid ${token.colorBorder};
	`,
	header: css`
		width: 100%;
		height: 40px;
		display: flex;
		align-items: center;
		font-size: 14px;
		padding: 2px 10px;
		border-bottom: 1px solid ${token.colorBorder};
	`,
	wrapper: css`
		width: 100%;
		padding: 12px;
	`,
}))
