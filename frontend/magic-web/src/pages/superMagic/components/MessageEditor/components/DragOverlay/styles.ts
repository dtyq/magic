import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	overlay: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 8px;
	`,
	content: css`
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: ${token.colorBgContainer};
		min-width: 240px;
		text-align: center;
	`,
	icon: css`
		color: ${token.colorPrimary};
	`,
	text: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	`,
}))
